# Proje Kararları

## Teknoloji Yığını

- Mobil uygulama: Flutter
- Backend: NestJS + TypeScript
- Yetkili paneli: Next.js + TypeScript
- Veritabanı: MySQL
- ORM: Prisma
- Arka plan işleri ve zamanlanmış bildirimler: Redis + BullMQ
- API yaklaşımı: REST
- API sözleşmesi: OpenAPI (`shared/openapi.yaml`)

## Beacon Standardı

- Cihaz: Minew E7
- Yayın formatı: iBeacon
- Advertising interval: 300–500 ms
- Aynı kongredeki tüm beacon cihazları ortak UUID kullanır.
- Major değeri salonu temsil eder.
- Minor değeri aynı salondaki fiziksel beacon cihazını temsil eder.
- Her salon, saha kalibrasyonuna göre 1–4 beacon kullanabilir.

## Takip Modeli

- Mobil uygulama kesin giriş/çıkış kaydı değil, zaman damgalı salon varlığı gözlemleri üretir.
- Uygulama açıkken yapılan RSSI doğrulaması yüksek güvenlidir.
- Arka plandaki iBeacon region olayları destekleyici, orta güvenli kanıttır.
- Veri gelmemesi, katılımcının salonda olmadığı anlamına gelmez.
- iOS’ta uygulama kullanıcı tarafından zorla kapatılırsa beacon gözlemi garanti edilemez.
- Bilimsel program bildirimleri, kullanıcının uygulamayı yeniden açmasını teşvik eder.
- **iOS'ta arka plan beacon takibi, ranging oturumunun sürekli açık tutulmasına
  dayanır** — uygulamayı arka planda "canlı" tutan mekanizma budur. Pil tasarrufu
  için ranging'i arka planda aç/kapa döngüsüne sokmak **denenmemeli**: bu, 2026-07
  pilotunda gerçek bir regresyona yol açtı (arka plan veri akışı tamamen kesildi —
  bkz. `docs/mobile-handoff.md`, "Arka Plan Ranging Regresyon Düzeltmesi"). Pil
  optimizasyonu, ranging'i durdurmadan, yalnızca gönderim (network) sıklığını
  ayarlayarak yapılmalı.

## Salon Tespit Algoritması v3 — Uygulama Sırasında Alınan Kararlar

`docs/algoritma-v3-uygulama-talimati.md` uygulanırken, canlı test sonucunda
spesifikasyondan **bilinçli olarak sapılan** noktalar. Kodu okuyan biri
spesifikasyonla çelişki sanmasın diye burada kayıtlı:

- **Hampel penceresi her zaman, koşulsuz kayar** (talimat §5 Katman 1.4
  "reddedilen okumada Redis state değişmez" diyordu). Yalnızca kabul edilen
  okumalar pencereye alındığında pencere homojenleşiyor, MAD küçülüyor, kabul
  bandı daralıyor ve katılımcı gerçekten hareket ettiğinde tüm yeni okumalar
  reddedilip pencere hiç güncellenmiyordu — referans eski konumda **kalıcı
  olarak kilitleniyordu**. Canlı testte doğrulandı: pencere `[-70,-68,-70,-71,-68]`
  değerinde dondu, 12 ardışık okuma elendi ve o beacon TTL boyunca (8 saat)
  karar hesabından tamamen düştü. Artık `isHampelOutlier` yalnızca "bu okuma
  EMA'ya beslensin mi" sorusunu cevaplıyor; pencereye ekleme koşulsuz. Tek
  seferlik sıçrama hâlâ eleniyor (medyan 5'te 1 uç değere zaten dayanıklı),
  ama sürekli bir değişim pencere dolunca kendiliğinden öğreniliyor.
  Sentinel (`rssi >= 0`) okumalar bunun istisnası: gerçek bir ölçüm olmadıkları
  için pencereye de girmezler, medyanı bozarlardı.
- **`MAD = 0` durumunda Hampel devre dışı.** Telefon sabit dururken RSSI aynı
  değere kuantalanır; `|x − medyan| > k · 0` kuralı medyandan 1 dB farklı her
  okumayı reddedip filtreyi kilitlerdi. Yukarıdaki kuralla birlikte durur:
  ikisi farklı sorunları çözer (bu kural EMA'nın donmasını, pencerenin
  kayması referansın donmasını önler).
- **Belirsizlik (AMBIGUOUS) yalnızca salon eşiğini geçen salonlar arasında
  aranır.** Aksi halde koridorda duran, iki salonu da zayıf gören bir katılımcı
  "belirsiz" sayılır, çıkış sayacı donar ve açık ziyareti hiç kapanmazdı.
- **Belirsizlikte açık ziyaret canlı tutulur** (`lastConfirmedAt` tazelenir),
  giriş/çıkış yine tetiklenmez. İki salon arasındaki duvarda oturan bir
  katılımcının tek bir 60 dakikalık ziyareti, aksi halde `stale-visit-sweep`
  tarafından 5 dakikada bir kapatılıp onlarca parçaya bölünür ve kalış
  süresi/medyan istatistikleri bozulurdu.
- **Salonda kalmak için hem yüzde hem salon eşiği aranır.** Yalnızca yüzdeye
  bakılsaydı, koridora çıkmış ama hâlâ tek başına o salonu gören bir katılımcı
  %100 yüzdeyle sonsuza kadar "içerde" görünürdü.
- **`PresenceStatus.NO_SIGNAL` iki gerçekliği birleştirir** (sinyal var ama
  hiçbir salon eşiğini geçmiyor / cihaz tamamen sessiz). Bilinçli bir
  basitleştirme: ayrım kaybolmuyor, Takip Sağlığı sayfası `lastObservationAt`
  üzerinden ikisini ayırıyor.
- **Güven yüzdesi sinyal kalitesi DEĞİL, salonlar arası göreceliktir.** Tek
  salon görülüyorsa sinyal −95 dBm bile olsa yüzde %100 çıkar; gerçek koruma
  her zaman `Hall.rssiThreshold` kapısıdır.

## Git Çalışma Düzeni

- `main`: Test edilmiş, kararlı sürümler.
- `develop`: Ortak entegrasyon branch’i.
- `feature/...`: Kişisel görev branch’leri.
- `main` ve `develop` branch’lerine doğrudan push yapılmaz.
- Her değişiklik Pull Request üzerinden kontrol edilir.
- API değişikliklerinde önce `shared/openapi.yaml` güncellenir.

## Faz 2 Kararları — Pilot Kimlik Doğrulama ve Observation Mimarisi

### Pilot girişi (`POST /auth/pilot-login`)

- Pilot/test aşamasında katılımcılar için önceden kod üretilmez. Katılımcı, kongreye
  ait ortak bir `congressCode` + `congressAccessCode` çifti girer; ardından aynı
  kongre içinde `firstName + lastName + phoneLast4` ile eşleşen bir kullanıcı aranır,
  yoksa oluşturulur.
- `phoneLast4` yalnızca aynı kişiyi tekrar tanımak (eşleştirme) içindir; raporlarda
  gösterilmez.
- **Bu akış yalnızca pilot/test kongreleri içindir.** Gerçek bir kongrede bu,
  resmi bir kayıt sistemi entegrasyonu veya kişiye özel doğrulama (ör. e-posta
  doğrulama, kongre kayıt numarası) ile değiştirilecektir.

### JWT stratejisi

- Pilot fazında yalnızca **access token** kullanılır; refresh token yoktur.
- Token payload'ı en az `sub` (userId), `congressId`, `role`, `tokenVersion` alanlarını içerir.
- Süre: şimdilik sabit 7 gün. İleride kongre `endDate` alanı üzerinden
  (`endDate + 24 saat`) hesaplanacak şekilde değiştirilebilir.
- `tokenVersion`, ileride toplu token iptali (ör. şifre/erişim kodu değişiminde
  tüm oturumları geçersiz kılma) için hazır tutulur; şu an için `User` oluşturulduğunda
  `0` olarak başlar ve her istekte doğrulanır.
- Token süresi dolduğunda veya geçersiz olduğunda backend `401` döner; mobil
  tarafı yeniden `pilot-login` akışına yönlendirir. Sunucu tarafı token iptal
  listesi (blacklist) bu fazda yoktur.

### Ham veri / backend-karar mimarisi

- Mobil uygulama salon kararı **vermez**. Yalnızca o anki ham iBeacon anlık
  görüntüsünü (`observationId`, `observedAt`, görülen beacon'ların
  `uuid/major/minor/rssi/txPower` listesi) gönderir.
- Salon giriş/çıkış kararı, ziyaret süresi ve güven hesaplaması tamamen
  **backend**'de (`AttendanceProcessingService`) yapılır. Bu, karar mantığının
  tek bir yerde toplanmasını, versiyonlanmasını (`algorithmVersion`) ve
  geçmiş verilerin yeniden işlenebilmesini sağlar.
- `POST /observations/batch` bu fazda yalnızca bir "sözleşme" değil, gerçek bir
  ingestion uç noktasıdır: JWT + cihaz sahiplik doğrulaması, `observationId`
  bazlı idempotency, ham kayıt ve ardından senkron `AttendanceProcessingService`
  tetiklemesi içerir. İleride bu tetikleme Redis tabanlı bir kuyruğa taşınabilir;
  bu yüzden ingestion ve attendance işleme kasıtlı olarak ayrı servislerdir.

## Faz 1 — Global Kullanici Modeli

Katilimcinin artik tek bir kongreye degil, e-posta/telefon + sifre ile
dogrulanan bir kimlige sahip olmasi ve kayitli oldugu kongreler arasindan
birini secip degistirebilmesi gerekiyordu. Bu, `User`in `congressId`ye
kilitli olmasindan (yukaridaki eski pilot modelin devami) coktan-coka bir
iliskiye (`CongressRegistration`) gecisi zorunlu kildi.

### Neden guard enjeksiyonu (User.congressId kaldirilirken davranis korunuyor)

`user.congressId` okuyan kod (attendance/observation-ingestion, vb.) beacon
zincirinin bir parcasi - bu faz **beacon zincirine dokunmama** kisitiyla
sinirliydi. Iki secenek vardi: (a) DB'deki `User.congressId`yi kaldirip her
kullanim yerini `CongressRegistration`e gore yeniden yazmak, ya da (b)
DB'den kaldirip runtime'da `JwtAuthGuard` icinde `request.user`e o
istekteki aktif kongreyi (`JwtPayload.activeCongressId`) `congressId`
adiyla enjekte etmek. (b) secildi:
- Beacon zincirindeki tum okuma noktalari (observation-ingestion.service.ts)
  TEK SATIR bile degismeden calismaya devam ediyor - regresyon riski en
  dusuk secenek.
- "Aktif kongre" kavrami zaten DOGASI GEREGI kalici bir DB alani degil,
  o oturumun (token'in) tasidigi gecici bir secim - bunu bir guard'da
  runtime'da tasimak, bir DB kolonunda tasimaktan daha dogru bir modelleme.
- Yalnizca 3 yer (attendance-processing, notification-scheduler,
  tracking-health) congressId'yi DOGRUDAN DB'den (User uzerinden) okuyordu;
  bunlar `CongressRegistration`e gore elle guncellendi, geri kalani
  dokunulmadan calisti.

### Neden `/auth/*` ActiveCongressGuard kullanmiyor

Kullanici kongre secmeden VE zorunlu sifre degisikligini tamamlamadan once
de giris yapip `/auth/me` ve `/auth/my-congresses` ile kendi kongrelerini
gorebilmeli, `/auth/select-congress` ile kongre secebilmeli ve
`/auth/change-password` ile sifresini degistirebilmeli - bunlarin hepsi
`ActiveCongressGuard`in tam da engellemeye calistigi durumun (kongre
secilmemis / sifre degistirilmemis) icinde calismak zorunda. Bu yuzden
guard `/auth/*` disindaki (observations, devices, notifications) kongre-ozel
uc noktalara eklendi; ayri bir "haric tutma" listesi tutmaya gerek kalmadi.

### pilot-login geriye donuk uyumlulugu

`POST /auth/pilot-login` TestFlight'taki mevcut mobil surum tarafindan hala
kullaniliyor ve bu fazda **silinmedi/degistirilmedi** - yalnizca ic
eslestirme mantigi `CongressRegistration`e tasindi (ayni ad+soyad+telefon-
son-4-hane eslesmesi, artik "bu kongride kaydi var mi" kontrolu
`CongressRegistration` uzerinden). Response sozlesmesi birebir ayni kaldi.
Faz 6'da yeni mobil giris akisi (`/auth/login` + `/auth/select-congress`)
devreye girdiginde bu endpoint kaldirilacak - o zamana kadar gecis koprusu
olarak duruyor.

## Faz 2 — Katılımcı Kayıt Yönetimi

Faz 1'in migration'ından gelen mevcut kullanicilarin e-postasi yoktu, bu
yuzden `/auth/register-request` hic kimse icin calismiyordu. Bu faz Excel/
CSV toplu yukleme + panelden manuel ekleme ile katilimcilara e-posta/
telefon kazandiriyor - `docs/mobile-next-tasks.md`'deki gibi degil, dogrudan
canli curl testiyle dogrulandi (import edilen bir katilimci gercekten
`register-request` -> `login` akisini tamamlayabildi).

### Neden iki asamali import (yukle -> onizle/duzelt -> onayla)

Dernekten gelen dosyalar kirli olabilir (bozuk e-posta, eksik ad, garip
telefon formati). Tek adimda dogrudan `User`/`CongressRegistration`
yazmak yerine once `RegistrationImport`/`RegistrationImportRow` staging
tablolarina yazilip yetkiliye onizleme + satir duzeltme + haric tutma
firsati taniniyor - hatali bir dosyanin yuzlerce yanlis kayit uretmesi
boylece tek bir ONAY adiminda engellenebiliyor. Onay tek bir transaction
icinde calisiyor: ya butun gecerli satirlar islenir ya da (beklenmeyen bir
hata durumunda) hicbiri islenmez - kismi/tutarsiz bir onay durumu olmaz.

### Neden libphonenumber-js (elle "+90 ekle" mantigi degil)

Kongreye yurt disindan da katilimci geliyor. Eski `parse-email-or-phone.ts`
ulke kodu olmayan HER numaraya `+90` ekliyordu - bu, yurt disi numaralari
(ornegin `441234567890` gibi ulke kodunu zaten iceren ama `0` ile
baslamayan bir girdiyi) sessizce bozuyordu. `libphonenumber-js` gercek bir
telefon numarasi kutuphanesi: `+`/`00` ile baslayan girdilerde kendi ulke
kodunu tanir ve varsayilan (`TR`) yok sayilir; elle yazilmis bir prefix
mantigindan cok daha guvenilir.

### Neden `phone` + `phoneRaw` ikilisi, neden normalize edilemeyen telefon satiri gecersiz kilmiyor

`User.phone` unique VE E.164 formatinda olmasi gerekiyor (giris icin
kullanilir, `/auth/login` bunun uzerinden arama yapar) - normalize
edilemeyen ("unparseable") bir deger buraya YAZILAMAZ. Ama katilimcinin/
dernegin verdigi ham deger tamamen atilirsa bu, talimattaki "hicbir girdi
kaybolmayacak" kisitini ihlal eder. Cozum: `phoneRaw` alani HER ZAMAN ham
metni tasir (unique degil, normalize edilebilir/edilemez fark etmez),
`phone` yalnizca gecerli bir E.164 uretilebildiginde dolar. Bu yuzden
normalize edilemeyen bir telefon TEK BASINA satiri INVALID yapmaz -
yalnizca bir uyari birakir (`phoneRaw` yine kaydedilir); satir yalnizca
kullanilabilir HICBIR iletisim bilgisi (ne gecerli e-posta ne kullanilabilir
telefon) yoksa gecersiz olur.

### Neden ad-soyad eslestirmesi yapilmadi

Import satirlarini mevcut kullanicilarla eslestirirken (MATCHED tespiti)
yalnizca normalize e-posta, sonra normalize telefon kullanildi. Ad+soyad
eslestirmesi bilerek KULLANILMADI - yaygin isimlerde (ayni ad+soyad
kombinasyonu farkli kisilerde) yanlis eslesme riski yuksek ve bu, bir
katilimcinin yanlislikla baska birinin hesabina/gecmisine baglanmasi
anlamina gelir. E-posta/telefon benzersiz oldugu icin guvenilir tek
eslestirme anahtaridir. (Faz 4'teki konusmaci eslestirmesi farkli bir
problem - orada e-posta yok, baska bir cozum gerekecek.)

### Neden silme yerine pasiflestirme

`POST /admin/registrations/:id/deactivate` gercek bir `DELETE` YAPMAZ,
yalnizca `CongressRegistration.isActive = false` yazar. Bir katilimcinin
beacon gecmisi (HallVisit/AttendanceEvent) `User.id`ye baglidir - kullanici
silinirse bu gecmis ya yetim kalir ya da cascade ile silinip raporlari
(katilim istatistikleri, salon doluluk gecmisi) geriye donuk bozar.
Pasiflestirme, kaydin panelde/register-request akisinda "aktif" gorunmesini
engellerken gecmis veriyi korur.

### phone/email unique cakismasi onayda neden "atla" davranisiyla cozuluyor

Import onaylanirken (`POST .../approve`) bir NEW satirin `email`/`phone`si,
parse ile onay arasinda gecen surede (ornegin ayni kisiyi iceren iki farkli
import arka arkaya onaylandiginda) baska bir kullaniciyla cakisabilir.
Prisma'nin unique constraint hatasi (P2002) bu durumda YAKALANIR, o satir
`DUPLICATE`e cevrilip atlanir, transaction devam eder - tek bir satirin
cakismasi butun onayi geri almaz. Bu, MySQL/Prisma'da gercek bir DB'ye
karsi canli test edilerek dogrulandi (iki import, ayni e-posta, art arda
onay - ikinci importun cakisan satiri DUPLICATE oldu, digeri basariyla
islendi, import yine APPROVED oldu).
