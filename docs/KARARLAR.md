# Kararlar ve Gerekçeleri

Bu doküman, projenin ilerleyişi sırasında alınan mimari/tasarım kararlarının
**neden** öyle alındığını anlatır — süreç anlatısı (hangi tarihte, kim,
hangi testte) değil, kalıcı gerekçe ve "bunu bilmeyen biri aynı hatayı tekrar
yapmasın" dersleri. Beacon/mobil/push/algoritma mimarisi için bkz.
`docs/MIMARI.md` ve `docs/ALGORITMA.md` — burada onların tekrarı yok.

## Kimlik ve katılımcı yönetimi

**Neden `libphonenumber-js`, elle "+90 ekle" mantığı değil.** Kongreye yurt
dışından da katılımcı geliyor. Ülke kodu olmayan HER numaraya `+90` eklemek,
yurt dışı numaralarını (ülke kodunu zaten içeren ama `0` ile başlamayan bir
girdiyi) sessizce bozar. `libphonenumber-js` gerçek bir telefon numarası
kütüphanesidir: `+`/`00` ile başlayan girdilerde kendi ülke kodunu tanır.

**Neden `phone` + `phoneRaw` ikilisi.** `User.phone` unique ve E.164
formatında olmak zorunda (girişte kullanılır) — normalize edilemeyen bir
değer buraya yazılamaz. Ama katılımcının/derneğin verdiği ham değeri
tamamen atmak "hiçbir girdi kaybolmayacak" ilkesini ihlal eder. Çözüm:
`phoneRaw` HER ZAMAN ham metni taşır (unique değil), `phone` yalnızca
geçerli bir E.164 üretilebildiğinde dolar. Normalize edilemeyen bir telefon
TEK BAŞINA satırı geçersiz kılmaz — yalnızca bir uyarı bırakır.

**Neden ad-soyad eşleştirmesi kullanılmıyor** (katılımcı importunda).
Yalnızca normalize e-posta, sonra normalize telefon kullanılır. Yaygın
isimlerde (aynı ad+soyad farklı kişilerde) yanlış eşleşme riski yüksektir —
bir katılımcının yanlışlıkla başka birinin hesabına/geçmişine bağlanması
anlamına gelir. E-posta/telefon benzersiz olduğu için tek güvenilir
eşleştirme anahtarıdır.

**Neden silme yerine pasifleştirme.** Bir katılımcının beacon geçmişi
(`HallVisit`/`AttendanceEvent`) `User.id`ye bağlıdır — kullanıcı silinirse
bu geçmiş ya yetim kalır ya da cascade ile silinip raporları geriye dönük
bozar. `isActive = false` kaydın panelde/kayıt akışında "aktif" görünmesini
engellerken geçmiş veriyi korur.

**Neden iki aşamalı toplu içe aktarma (yükle → önizle/düzelt → onayla).**
Dernekten gelen dosyalar kirli olabilir (bozuk e-posta, eksik ad, garip
telefon formatı). Tek adımda doğrudan yazmak yerine staging tablolarına
yazılıp yetkiliye önizleme + satır düzeltme + hariç tutma fırsatı tanınır —
hatalı bir dosyanın yüzlerce yanlış kayıt üretmesi tek bir onay adımında
engellenir. Onay tek bir transaction içinde çalışır (ya hepsi ya hiçbiri).
Aynı desen bilimsel program içe aktarmasında da kullanılır.

**`xlsx` (SheetJS) paketi neden npm registry dışından geliyor.** npm
registry'deki son sürüm yamasız güvenlik açıkları taşıyor
(Prototype Pollution + ReDoS); SheetJS bunları yalnızca kendi CDN'inde
yayınladığı sürümlerde düzeltiyor. Bağımlılık bu yüzden `package.json`da bir
npm sürüm numarası değil, **sürümü pinlenmiş** bir tarball URL'i olarak
tanımlı (`xlsx-latest` gibi hareketli bir hedef DEĞİL — bu, `package-lock.json`
integrity hash'inin CDN dosyası güncellenince sessizce değil GÜRÜLTÜLÜ
şekilde bozulmasına, deploy ortasında kesilmeye yol açardı). Güncelleme
bilinçli bir işlemdir: yeni sürüm gerektiğinde URL'deki sürüm numarası elle
değiştirilip `npm ci` ile yeniden doğrulanır. `npm audit` bu paketi
(registry dışında olduğu için) izleyemez.

## Türkçe metin normalizasyonu

**Neden `toLowerCase()`/`toLocaleLowerCase('tr')` yerine elle karakter
eşleme.** `"İ".toLowerCase()` platforma göre `"i"` yerine `"i̇"` (i +
birleşik nokta) üretebilir; `"I".toLowerCase()` locale ayarına göre `"ı"`
verebilir — ikisi de arama/eşleştirme için tutarsız sonuç demektir (aynı
kişi iki farklı normalize edilmiş isim üretebilir). Bunun yerine 6 Türkçe
harf çifti (İ/I/ı→i, Ş/ş→s, Ğ/ğ→g, Ü/ü→u, Ö/ö→o, Ç/ç→c) ELLE, tek tek ASCII
karşılığına çevrilir, SONRA geriye kalan (artık ASCII) metin üzerinde genel
`toLowerCase()` çağrılır — platform/locale farklılıklarından tamamen
bağımsız, deterministik bir sonuç.

## Bilimsel program çıkarımı (LLM)

**Neden LLM kimlik eşleştirmesi yapmıyor, yalnızca ham metin çıkarıyor.**
Görev bilerek ikiye bölünmüştür: LLM yalnızca belgede ne yazdığını raporlar
(isim, saat, salon adı — hepsi ham metin); kimlik eşleştirmesi (hangi
katılımcı, hangi salon, hangi gerçek tarih/saat) tamamen backend'de,
deterministik kodla yapılır. LLM'e `userId`/`hallId`/`sessionId` UYDURTULMAZ —
bir LLM'in "muhtemelen bu kişi" diye bir eşleştirme uydurması, yanlış kişiyi
doğru gibi göstermek anlamına gelir; bu, hiç eşleştirmemekten daha kötü bir
kullanıcı deneyimidir. Aynı gerekçeyle genel eşleştirme mantığı da **bulanık
(fuzzy) değildir** — yalnızca birebir `searchName` eşitliğine bakılır, net
uç durumlar üretilir (`MATCHED`/`AMBIGUOUS`/`UNMATCHED`), belirsiz/eşleşmeyen
durumlarda yetkili elle karar verir.

**Neden tarih/saat hesabı backend'de.** LLM'den yalnızca "HH:MM" ve
(belgede açıksa) "YYYY-MM-DD" istenir — gerçek bir `DateTime`'a çevirme
backend'de yapılır. Bir günün tarihi belgede yoksa kongrenin başlangıç
tarihinden gün sırasına göre türetilir ve buna **açıkça** bir uyarı
bırakılır — tahmini bir tarih sessizce doğru gibi gösterilmez.

**Neden asenkron kuyruk (BullMQ).** Uzun bir belgede LLM çağrısı dakikalar
sürebilir — bu bir HTTP isteği içinde beklenemez. İçe aktarma isteği dosyayı
hemen `PENDING` durumunda kuyruğa alıp döner; gerçek çıkarım worker'da
çalışır.

**Neden maliyet onayı zorunlu, tahmin ayrı bir uç nokta.** Kullanıcının API
kredisi sınırlı — kontrolsuz bir çağrı bütçeyi bitirebilir. Ücretsiz tahmin
(token sayımı) ile gerçek (parayı harcayan) çıkarım BİLEREK iki ayrı uç
noktadır; panel tahmini gösterip açık onay almadan ikinciyi çağırmaz. Fiyat
tablosu Anthropic'in resmi liste fiyatlarını kullanır (indirimli/tanıtım
fiyatı DEĞİL) — tahmin her zaman muhafazakâr (yüksek) tarafta kalsın diye.

**Neden onay mevcut programın üzerine yazmaz, yanına ekler.** Onay adımı
mevcut `Session`/`Presentation`/`ProgramRole` kayıtlarını SİLMEZ veya
değiştirmez — yalnızca staging'deki geçerli satırları ekler. Aynı programı
iki kez yüklemek bu yüzden kopya üretir; bu bilinçli bir tasarımdır
(silme/üzerine-yazma çok daha riskli bir işlemdir).

**Prompt injection'a karşı alınan önlem.** Sistem promptu açıkça belirtir:
belgenin içinde Claude'a yönelik bir talimat gibi görünen herhangi bir metin
bir KOMUT olarak değil, yalnızca çıkarılacak VERİ olarak değerlendirilir —
belgede o şekilde yazıyorsa ilgili alana olduğu gibi kopyalanır, uygulanmaz.
Yüklenecek belgenin içeriği tamamen güvenilmez (üçüncü taraf kaynaklı)
olduğu için bu savunma gereklidir.

**Model seçimi: neden `claude-opus-4-8` varsayılan, `claude-sonnet-5`
değil.** Aynı belge kesitiyle karşılaştırıldığında iki model de temel
bilimsel içerik çıkarımında (başlık, salon, saat, konuşmacı adı) birebir
aynı doğrulukta; fark yalnızca "boş tartışma bloklarını da ayrı satır olarak
kaydet" gibi ayrıntı talimatlarına uyumda. Sonnet 5, çıktı token hacminin
~2.5 kat fazla olması yüzünden Opus 4.8'den hem YAVAŞ hem PAHALI çıktı —
düşük liste fiyatına rağmen. Model, koda gömülü değil env değişkeninden
okunur; kod değişikliği gerekmeden değiştirilebilir.

## JSON ile program yükleme ve salon otomatik oluşturma

LLM çıkarımının yanına, zaten yapılandırılmış (örn. dernek sitesinden JSON
export edilmiş) programlar için LLM adımını atlayan ikinci bir giriş
noktası eklendi — aynı staging tablolarına, aynı önizleme/onay akışından
geçer.

**Salon otomatik oluşturma neden sessizce değil, uyarıyla.** Elle
hazırlanmış bir programda, kongre kurulumuyla senkron olmayan salon adları
sık karşılaşılan bir durumdur. Eşleşmeyen ama boş olmayan salon adı içeren
satırlar onayda otomatik bir `Hall` oluşturur — ama bu SESSİZ değildir: onay
sonrası panelde belirgin bir uyarı ("şu salonlara henüz beacon atanmadı")
gösterilir. Bir salonun beacon'suz kalıp sessizce veri kaybına yol açması
("veri neden gelmiyor" teşhisi) projede birden fazla kez gerçek zaman
kaybettirdiği için bu uyarı görmezden gelinemeyecek kadar belirgin
tutulmuştur.

## Kanonik program şeması

**Neden hiyerarşik yapı (`days[].halls[].events[].items[]`), düz liste
değil.** Düz bir `sessions[]` listesi her oturumda günü/salonu TEKRAR
ETTİRİR — hem elle JSON hazırlarken hataya açıktır hem de gerçek kongre
programlarının PDF/Excel'de göründüğü doğal şekli yansıtmaz.

**Tek kaynak: `shared/congress-program.schema.json`.** Şema backend'in
DIŞINDA, JSON Schema olarak tutulur; TypeScript'te ikinci kez elle
yazılmaz — hem LLM'in strict-mode şeması hem kullanıcı yüklemesinin
null-toleranslı şeması aynı kaynaktan türetilir.

**Yapısal ve anlamsal doğrulama bilerek ayrıldı.** Yapısal bütünlük
(zorunlu alanlar, tipler, `endTime >= startTime`) HATA sayılır, yükleme
reddedilir. Çapraz-referans gerektiren kontroller (kongre tarih aralığı
dışı bir gün, çakışan etkinlik gibi) BİLEREK yalnızca bir `warning` üretir,
yüklemeyi reddetmez — bu tür sorunlar çoğu zaman veri hatası değil, henüz
girilmemiş bir kongre tarihi gibi geçici durumlardır.

**`type: "break"/"ceremony"` ve `"discussion"` öğeleri neden atlanmıyor.**
Konuşmacısı/sunumu olmasa bile birer `Presentation`/`Session` satırı olarak
yazılırlar — bir program öğesinin sessizce kaybolması, kullanıcının
PDF/Excel'de gördüğü programla panelde gördüğü program arasında fark
yaratır. Mobil tarafta bu satırlar `_isMinorEvent` ile görsel olarak
ayrıştırılır ve **dokunulamaz** (kart değil, bilgi satırı).

## E-posta gönderimi (Brevo)

**Gmail iOS uygulamasının "..." ile katlanmış görünme hatası.** Kök neden:
Brevo'nun SMTP relay'i her transactional e-postaya, gövdenin en başına,
kapatılamayan bir açık-izleme pikseli + MSO koşullu yorum bloğu enjekte
ediyor. Gövdenin başında gerçek/görünür bir metin olmayınca Gmail'in mobil
uygulaması ilk render'da içeriği katlanmış gösterip dokunmayı bekliyordu —
yalnızca Gmail iOS'a özgü (masaüstü web ve Outlook mobil etkilenmiyordu).
Düzeltme: Brevo'nun enjeksiyonundan ÖNCE, gövdenin ilk içeriği olarak gizli
ama gerçek bir "preheader" metin bloğu eklendi.

**Doğrulama kodu gönderiminde kilitlenme önleme.** E-posta gönderimi artık
şifre hash'i güncellemesinden ÖNCE denenir (eski sırada: önce hash
değiştiriliyor, sonra gönderiliyordu — SMTP hatası olursa kullanıcının eski
şifresi geçersiz kılınmış ama yeni kod hiç ulaşmamış oluyordu, kullanıcı
kilitleniyordu). Gönderim başarısız olursa (kod/şifre ASLA loglanmadan)
`503` döner, veritabanına hiç dokunulmaz.

## Panel (Next.js 16) — sürüme özgü davranışlar

- `page.tsx`'te hem `searchParams` HEM `params` (dinamik route segmentleri)
  `Promise` döner.
- Route segment `error.tsx` dosyaları `reset` DEĞİL `unstable_retry` prop'u
  alır.
- `'use server'` dosyasının TÜM export'ları async fonksiyon OLMAK
  ZORUNDADIR — sabit değer/obje export etmek derleme hatası verir (tip
  export'ları hariç, derleme zamanında silinir).
- **Uncontrolled form alanları, HER Server Action gönderiminden sonra
  (başarılı VEYA başarısız fark etmez) `defaultValue`sine sıfırlanır.** Bu,
  gerçek bir üretim hatasına yol açmıştı: bir "409 → onayla ve taşı" akışında,
  ilk (çakışan) gönderim sonrası alan sessizce eski değerine dönüyor,
  kullanıcı "Onayla"ya bassa bile DOM'daki eski değer gönderiliyor,
  migrasyon sessizce no-op oluyordu. Formdan sonra da state'i koruması
  gereken herhangi bir alan `useState` + `value`/`onChange` ile controlled
  yapılmalıdır.
- Server Action'a giden HTTP gövdesi varsayılan olarak 1MB ile sınırlıdır
  (`experimental.serverActions.bodySizeLimit`) — dosya yükleyen akışlar bu
  sınırı görünür şekilde artırmalı veya (2MB'ı aşan görseller gibi) doğrudan
  backend'e client-side `fetch` ile gitmelidir.

Panelin tasarım sistemi, veri-çekme desenleri ve bileşen kalıpları için
`.claude/agent-memory/frontend-dashboard-developer/` altındaki ajan hafızası
kaynak alınmalı (kod yorumları da bu kararların çoğunu taşır).

## Mobil paket seçimleri

`flutter_markdown` (resmi paket) Flutter ekibi tarafından durduruldu —
`flutter_markdown_plus` (aynı yayıncının resmi devam projesi) tercih edildi.
`cached_network_image` (en bilinen ağ-görseli-önbellekleme paketi) pub.dev'de
yüksek puanlı görünse de GitHub'da fiilen bakımsız (uzun süredir commit
almıyor) — `extended_image` (doğrulanmış yayıncı, aktif bakımlı) tercih
edildi. **Ders:** pub.dev'in "likes/pub points" skoru bakım durumunun
güvenilir bir göstergesi değildir — son yayın tarihi ve GitHub'daki gerçek
commit/issue aktivitesi kontrol edilmeli.

## Ölçekte tekrar eden bir mimari kalıp: "önce yerel önbellek, sonra ağ"

Mobil taraftaki 9 `/mobile/*` ucunun tamamı aynı deseni izler: önce
önbellekten göster, arkadan ağa doğrula, ağ başarısız olursa önbellekteki
değere sessizce düş (hata değil, "bayat ama görünür" veri). Bu, kongre
salonunda ağın kötü/yok olacağı varsayımıyla bilinçli bir tasarımdır. Bir
ekranın **kritik** yolu (ör. program ekranının gün filtresi, tüm programı
gizleyebiliyordu) daha kısa ömürlü, ayrı bir önbelleğe bağımlı olmamalı —
mümkünse tek bir kalıcı kaynaktan türetilmeli (gerçek bir üretim hatası
olarak yakalanıp düzeltildi, bkz. `docs/MIMARI.md` "Çevrimdışı soğuk
başlangıç").

## Görsel yükleme mimarisi

**Neden dosya sistemi, bulut depolama (S3 vb.) değil.** Yüklenen görseller
küçük hacimli (2MB sınırı) ve düşük trafikli — ayrı bir bulut depolama
servisi/SDK/kimlik yönetimi eklemek bu ölçekte gereksiz karmaşıklık.
Bedeli: production'da konteyner yeniden oluşturulunca dizin sıfırlanır —
bu yüzden kalıcı bir Docker volume gerekir (bkz. `docs/KURULUM.md`).

**Neden `Venue` tek tablo + enum, iki ayrı tablo değil.** Otel ve ana
kongre mekânı aynı alan setini paylaşır — tek fark hangi tür mekân olduğu.

**Neden `KeynoteSpeaker` bilimsel programdan bağımsız.** Mobil ana
sayfadaki küçük bir vitrin listesidir (tipik 3-10 kişi) — tam bilimsel
programdaki (yüzlerce kayıt olabilen) konuşmacılarla BİLEREK
ilişkilendirilmedi; ilişkilendirmek "bu konuşmacı aynı zamanda bir
oturumda konuşuyor mu" gibi bir tutarlılık kısıtı getirir ve vitrin
listesinin amacını (yetkilinin elle seçtiği küçük bir grup) bozar.

## API tasarımı

**ETag stratejisi yalnızca `/mobile/program`da var.** Program yüzlerce
oturum içerebilir ve nadiren değişir — mobil her açılışta yeniden
indirmemeli. Diğer küçük/değişken uçlara (duyurular, sponsorlar) bilinçli
olarak eklenmedi — kazanç/karmaşıklık oranı yeterince güçlü değil.

**Görsel URL'leri neden mutlak.** Yüklenen görseller göreli yol olarak
saklanır; mobil FARKLI bir origin'den çalıştığı için bu dönüşüm TEK bir
yerde (`common/absolute-url.ts`, `APP_PUBLIC_URL`) yapılır.

**"Okunmamış duyuru" için sunucu tarafı bir okuma-durumu tablosu
kurulmadı.** `/mobile/home` yalnızca `hasPinned` + `latestPublishedAt`
döner; mobil uygulama bunu kendi yerel "son görüleni" ile kıyaslar — salt
okunur bir API fazı için ölçüsüz bir kapsam genişlemesi olurdu.

## Veritabanı/servis katmanı kalıpları

**Neden beş içerik türü (Venue/Announcement/Sponsor/KeynoteSpeaker/
InfoSection) ortak bir `ContentCrudService` üzerinden.** Beş türün CRUD
davranışı (kongre-scope doğrulaması, silme/değişimde eski görseli diskten
temizleme, toplu sıralama) birebir aynı — beş kez kopyalamak yerine tek
soyut sınıf.

**Neden gerçek dosya, farklı şema olan test verisi ikinci bir şemaya
dönüştürülmedi.** Kullanıcının gerçek kongre programı dosyası talimattaki
kanonik şemayla uyuşmuyordu; ikinci, daha zengin bir şema İCAT EDİLMEDİ
(kapsam bilerek dar tutuldu) — dosya yalnızca test hazırlığı için tek
seferlik bir dönüştürme betiğiyle kullanıldı.

## Beacon yazma tamponu yarış durumu (Faz 10.1)

`BeaconObservationService._flushWriteBuffer`, beş ayrı yerden (periyodik
zamanlayıcı, arka plana geçiş, tampon eşiği, batch gönderimi öncesi,
`stop()`) çağrılıyordu ve re-entrancy koruması yoktu — çakışan iki çağrı,
biri tamponu boşaltırken diğeri kendi payını çıkaramayıp `RangeError`
fırlatıyordu. Düzeltme `if (_isFlushing) return;` gibi bir kısayol
KULLANMADI (bu, arka plana geçerken yapılan flush'ı atlayıp force-quit'te
veri kaybına yol açardı) — bunun yerine çağrılar bir `Future` zincirine
(`_flushChain`) serileştirildi: her çağrı bir öncekinin bitmesini bekleyip
kendi turunu çalıştırır, aynı anda en fazla tek bir flush çalışır, hiçbir
istek düşürülmez. Gerçek aktif beacon donanımı yakınında, uygulama
~15-25 saniyeden uzun ön planda kaldığında neredeyse her seferinde
tetiklenen bir hataydı; düzeltmeden sonra 3+5 dakikalık gerçek cihaz
testlerinde hiç tekrarlanmadı.
