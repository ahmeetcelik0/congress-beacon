# Mimari

## Bileşenler ve teknoloji yığını

| Bileşen | Teknoloji | Görevi |
|---|---|---|
| Mobil uygulama | Flutter (iOS) | Katılımcının kullandığı uygulama: kimlik, bilimsel program, beacon gözlemi, push bildirimleri |
| Backend | NestJS + TypeScript | Tüm iş mantığı, API, salon tespit algoritması, bildirim zamanlaması |
| Yetkili paneli | Next.js 16 + TypeScript | Kongre/salon/beacon/program/katılımcı yönetimi, raporlar |
| Veritabanı | MySQL + Prisma | Tek gerçek veri kaynağı |
| Arka plan işleri | Redis + BullMQ | Bildirim zamanlama, bayat-ziyaret temizliği, sinyal state önbelleği |
| API sözleşmesi | OpenAPI (`shared/openapi.yaml`) | Backend/panel arası tek kaynak |
| Beacon donanımı | Minew E7, iBeacon | Salonlara yerleştirilen fiziksel vericiler |

## Beacon standardı

- Aynı kongredeki tüm beacon cihazları **ortak bir UUID** kullanır
  (`Congress.beaconUuid`) — iOS'un bölge taraması bu UUID'ye göre çalışır.
- **Major** = salon, **Minor** = o salondaki fiziksel cihaz. Bir salon,
  saha kalibrasyonuna göre 1-4 beacon kullanabilir.
- UUID tutarlılığı backend'de **zorlanır**: bir beacon eklenirken/
  güncellenirken UUID'si kongrenin UUID'siyle uyuşmuyorsa `400` döner.
  Kongrenin UUID'si boşsa (ilk beacon) otomatik benimsenir. Kongrenin
  UUID'si değiştirilip kongrede zaten beacon varsa varsayılan `409` —
  `migrateExistingBeacons: true` ile açıkça onaylanırsa kongre + tüm
  beacon'lar tek transaction'da güncellenir. Sessiz otomatik senkronizasyon
  yoktur (bkz. `docs/KARARLAR.md`).

## Takip modeli — ne ölçülüyor, ne ölçülmüyor

Mobil uygulama **kesin bir giriş/çıkış kaydı değil**, zaman damgalı salon
varlığı gözlemleri üretir. Salon kararı, ziyaret süresi ve güven hesaplaması
tamamen **backend**'de yapılır (bkz. `docs/ALGORITMA.md`) — mobil taraf hiçbir
salon kararı vermez, yalnızca o anki ham iBeacon anlık görüntüsünü
(`observationId`, `observedAt`, görülen beacon'ların `uuid/major/minor/rssi`
listesi) gönderir. Bunun nedeni: karar mantığının tek bir yerde toplanması,
versiyonlanabilmesi (`algorithmVersion`) ve geçmiş verilerin farklı bir
algoritma sürümüyle yeniden işlenebilmesi.

Sonuç olarak: veri gelmemesi katılımcının salonda olmadığı anlamına gelmez
(sinyal kaybı/uygulama arka planda/telefon kapalı olabilir); uygulama
kullanıcı tarafından zorla kapatılırsa (iOS force-quit) beacon gözlemi garanti
edilmez.

## Mobil beacon akışı — kritik kural

**iOS'ta arka plan beacon takibi, ranging oturumunun sürekli açık
tutulmasına dayanır** — bu, uygulamayı arka planda "canlı" tutan
mekanizmanın ta kendisidir. Ranging'i arka planda aç/kapa döngüsüne sokmak
(pil tasarrufu için cazip görünse de) **denenmemeli**: 2026-07'de tam olarak
bu denenmiş ve arka plan veri akışını tamamen kesmişti (bölge girişi
olayı — `didEnterRegion` — yalnızca salona girişte BİR KEZ tetiklenir,
salonda kalındığı sürece tekrar tetiklenmez). Pil optimizasyonu ranging'i
durdurmadan, yalnızca **gönderim (network) sıklığını** ayarlayarak yapılır.

Ön planda ranging periyodik bir duty-cycle ile çalışır (varsayılan: 10
saniyede bir 4 saniyelik tarama penceresi) — sürekli tarama yerine pil
tasarrufu. Arka planda ranging hiç durmaz, yalnızca gönderim aralığı
seyreltilir.

Gözlemler önce küçük bir bellek tamponuna yazılır (`_onRangingResult`
senkron bir callback olduğu için içine `await` konamaz), tampon 10
kayda ulaşınca veya 5 saniyede bir kalıcı SQLite kuyruğuna taşınır. Bu
taşıma (`_flushWriteBuffer`/`_doFlush`) bir `Future` zincirine
serileştirilmiştir — aynı anda en fazla tek bir taşıma işlemi çalışır,
hiçbir taşıma isteği düşürülmez (bkz. `docs/KARARLAR.md` "Faz 10.1").

`BeaconObservationService`'in ranging/duty-cycle/kuyruk mantığı, saha
testlerinde defalarca kırılganlığı kanıtlanmış bir yüzeydir — projede tekrar
eden bir kural: **bu servisin çekirdek mantığına ancak açıkça izin verilen
bir "çıkış noktası" eklenerek dokunulur** (ör. yeni bir durum yayma), karar
mantığı her zaman çağıran katmanda (`ObservationLifecycleNotifier`) kalır.

## Kalıcı çevrimdışı kuyruk (mobil, SQLite)

**MySQL sunucuda, SQLite telefonda** — ikisi rakip değil, farklı katmanlar.
MySQL tek gerçek veri kaynağı olarak kalır. Bir gözlem internet varsa
doğrudan backend'e gidip MySQL'e yazılır; yoksa telefonda (SQLite'ta)
bekler. Kuyruk `congressId`+`userId`'ye göre kalıcıdır — uygulama tamamen
kapatılıp yeniden açılsa bile korunur (uygulama son kez `stop()`
edilmeden önce bellek tamponu diske **beklenerek** (`await`) yazılır).

Kapsam kuralları (sessiz veri bozulmasını önlemek için):
- Kongre/kullanıcı değişince kuyruk tamamen temizlenir.
- Çıkış yapılınca (yalnızca **açıkça** "Çıkış Yap"a basılınca — 401/token
  süresi dolması gibi istemsiz oturum düşüşlerinde DEĞİL) kuyruk temizlenir.
- 72 saatten eski kayıtlar silinir (kongre bitmiş, veri anlamını yitirmiş).
- 100.000 kaydı aşan kuyruklarda en eski kayıtlar silinir.

Gönderim en fazla 500 kayıtlık gruplar halinde, kademeli olarak yapılır
(backend'in gövde sınırı 2MB'a çıkarılmıştır, bkz. `main.ts`).

## Çevrimdışı soğuk başlangıç (mobil kimlik doğrulama)

`AuthSessionNotifier` normalde her açılışta gerçekten `GET /auth/me` çağırır
(yerel token'a körü körüne güvenmez). Ağ **hatasıyla** (401 değil — sunucuya
hiç ulaşılamadı) karşılaşılırsa: saklanan JWT'nin `exp`i **yerelde**
kontrol edilir; geçerliyse ve daha önce başarılı bir `/auth/me` yanıtı
önbellekte varsa, uygulama **son bilinen oturum bilgisiyle** açılır ve
kalıcı bir "Çevrimdışı" şeridi gösterilir. Süresi dolmuşsa oturum silinir,
giriş ekranı gösterilir. Ağ varken davranış hiç değişmez — yerel kontrol
yalnızca ağ hatası dalında devreye girer. Bu, imza doğrulaması **değildir**
(saldırgan modeli yok, veri kullanıcının zaten gördüğü kendi verisidir) —
yalnızca "ağ yokken önbelleği göstermek mi, oturumu düşürmek mi makul"
sorusuna cevap verir; sunucu tarafı iptal (`tokenVersion` artışı) ağ
döndüğü an zaten uygulanır.

`/mobile/program` **kalıcı** (dosya) önbellekli tek uçtur — kongre boyunca
nadiren değişir, uygulama yeniden kurulsa bile son bilinen programı
gösterebilmelidir. Diğer 8 mobil ucu (home, duyurular, sponsorlar...)
yalnızca bellek-içi önbelleklidir. Gün sekmeleri ve oturum detayı **ayrı
bir önbelleğe bağlı değildir** — ikisi de zaten kalıcı önbelleklenmiş
`/mobile/program` listesinden türetilir (bir ekranın kritik yolu, daha kısa
ömürlü bir önbelleğe bağımlı olmamalı).

## Kimlik ve yetkilendirme

- `User` global bir kimliktir; kongre katılımı çoktan-çoka bir ilişki
  (`CongressRegistration`) üzerinden kurulur — kullanıcı yalnızca kayıtlı
  olduğu kongreleri görür, profilden değiştirebilir.
- JWT payload'ı `activeCongressId` taşır; `JwtAuthGuard` bunu
  `request.user.congressId` olarak enjekte eder — beacon zincirindeki
  tüm okuma noktaları bu sayede hiç değişmeden çalışır.
- 6 haneli doğrulama kodu doğrudan geçici şifre olur, ilk girişte değişim
  zorunludur (`mustChangePassword`). Kod e-postaya gider.
- Mobil uçların hiçbiri `congressId`'yi query/body parametresi olarak kabul
  etmez — kongre kimliği her zaman token'dan okunur; bu, kötü niyetli bir
  istemcinin başka bir kongrenin verisini istemesini yapısal olarak
  imkânsız kılar.
- Panel tarafı ayrı bir `AdminUser` modeli ve JWT'siyle çalışır, tüm
  yönetim/attendance/rapor uçları korunur, aksiyonlar `AuditLog`'a yazılır.

## Cihaz kurtarma

Backend'in "bu cihaz bu kullanıcıya ait değil" (`403`) dediği durumlarda
(cihaz silinmiş/başka kullanıcıya taşınmış) `ObservationLifecycleNotifier`
kendini onarır: eski `deviceId` silinir, yeniden kayıt yapılır, bekleyen
kuyruk yeni servise aktarılır. Ardışık 3 başarısız denemeden sonra 60
saniyelik bir soğuma uygulanır. Karar mantığı bilinçli olarak
`BeaconObservationService`'in **dışında** tutulur (bkz. yukarıdaki "çıkış
noktası" kuralı).

## Push bildirimleri

`NotificationSchedulerService` her oturum için iki bağımsız BullMQ job'ı
planlar: `trigger-reminder` (başlangıçtan 10dk önce) ve `trigger-start`
(başlangıç anı). Bir tetikleyici ateş aldığında **göndermez** — aynı
(kongre, dakika) kovası için 5 saniye gecikmeli bir "flush" job'ı planlar;
aynı dakikada başka oturumların tetikleyicileri BullMQ tarafından doğal
olarak aynı jobId'de tekilleştirilir, böylece aynı dakikada başlayan birden
fazla oturum **tek** bir bildirimde birleştirilir. Kullanıcı başına saatlik
gönderim sınırı vardır (varsayılan 6) — aşılırsa gönderim yapılmaz ama
`NotificationLog`a `SKIPPED` olarak iz bırakılır, sessizce yutulmaz.
Geçmiş tarihli oturumlara (toplu program içe aktarımı yüzlerce geçmiş
oturum üretebilir) job kurulmaz.

## Bilimsel program veri modeli

İki seviyeli: bir `Session` (oturum) içinde birden fazla `Presentation`
(sunum), her birinin kendi `ProgramRole` (moderatör/konuşmacı/tartışmacı)
kayıtları olur. Program içe aktarma (PDF/Excel → LLM, veya elle hazırlanmış
JSON) kanonik, hiyerarşik bir şemadan (`shared/congress-program.schema.json`,
`days[].halls[].events[].items[]`) geçer — önce staging tablolarına yazılır,
yetkili önizleyip düzeltir, sonra onaylanır. Onay mevcut programın **üzerine
yazmaz**, yanına ekler. Detaylı gerekçeler `docs/KARARLAR.md`da.

## Görsel yükleme

Kapak/mekan/sponsor/konuşmacı görselleri `backend/uploads/` dizinine
(dosya sistemi, bulut depolama değil) yazılır. Güvenlik: dosya adı/uzantısı
**hiçbir zaman** güvenilmez — gerçek dosya türü ilk birkaç byte'ın
(magic-byte) imzasından doğrulanır, dosya adı sunucu tarafında
`randomUUID()` ile üretilir (path traversal yapısal olarak imkânsız).
Production'da bu dizin kalıcı bir Docker volume'una bağlıdır (bkz.
`docs/KURULUM.md`).

## Kişisel veri sınırı

Mobil uçlar (katılımcıya açık) yanıtlarında **başka** katılımcıların
e-postası/telefonu/arama-adı/giriş geçmişi asla görünmez — her mobil Prisma
sorgusunda `ProgramRole` için `user` ilişkisi asla JOIN edilmez, yalnızca
skaler `userId` seçilir (`MOBILE_PROGRAM_ROLE_SELECT`, tek doğrulama
noktası). Bu, admin panelindeki `ROLE_USER_SELECT`'ten (yetkilinin eşleşen
katılımcıyı arayabilmesi gerekir) bilinçli olarak farklıdır.

## Salon tespit algoritması

Ayrı doküman: `docs/ALGORITMA.md`.

## Genel mimari ve teknik kararların gerekçeleri

Ayrı doküman: `docs/KARARLAR.md`.
