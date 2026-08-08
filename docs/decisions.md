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

### `xlsx` neden npm registry disindan geliyor, ve neden SURUM PINLI

`xlsx` (SheetJS) paketinin npm registry'deki son surumu (0.18.5, 2022'den
beri guncellenmemis) 2 adet HIGH onem dereceli yamasiz acik tasiyor
(Prototype Pollution + ReDoS - `npm audit` bunu dogrudan isaretliyor).
SheetJS bu acik lari kendi CDN'inde (`cdn.sheetjs.com`) yayinladigi
surumlerde duzeltti ama npm registry'sine artik yeni surum yuklemiyor -
bu yuzden bagimlilik `package.json`da bir npm surum numarasi degil,
dogrudan bir tarball URL'i olarak tanimli.

**Ilk halinde (Faz 2) `xlsx-latest` (hareketli hedef) kullanilmisti - bu bir
production riskiydi:** SheetJS CDN'deki `xlsx-latest` dosyasini
guncelledigi an, `package-lock.json`daki integrity hash'i artik indirilen
dosyayla eslesmez ve `npm ci` (production/CI kurulumu bunu kullanir)
sessizce degil, GURULTULU sekilde patlar - deploy ortasinda kesilme riski.
Faz 3'te surum-pinli URL'ye (`xlsx-0.20.3/xlsx-0.20.3.tgz`) gecirildi ve
`npm ci` ile temiz kurulumun calistigi dogrulandi. **Sonuc:** bu bagimliligin
guncellenmesi artik npm'in otomatik surum cozumlemesiyle degil, BILINCLI
bir islemle olur - yeni bir SheetJS surumu gerektiginde `package.json`daki
URL'deki surum numarasi elle degistirilip `npm install` + `npm ci` ile
yeniden dogrulanmali. `npm audit` bu paketi (registry disinda oldugu icin)
izleyemez - guvenlik duyurularini takip etmek elle yapilmali.

## Faz 3 — Kongre İçerik Yönetimi

Mobil ana sayfada gosterilecek kongre icerigi (genel bilgi, otel/mekan,
ana konusmacilar, duyurular, sponsorlar) icin yonetim (admin) API'si ve
gorsel yukleme altyapisi. Mobil tarafin bu veriyi OKUYACAGI `/mobile/...`
uclari kapsam disi (Faz 5) - bu faz sadece yazma/yonetim tarafi.

### Neden Venue tek tablo + `VenueType` enum, iki ayri tablo degil

Otel ve ana kongre mekani ayni alan setini paylasiyor (isim, adres, harita
linki, iletisim, gorsel, siralama) - tek fark "hangi tur mekan oldugu".
Iki ayri tablo (`Hotel`, `MainVenue`) bu alanlarin tamamini birebir
tekrar ederdi ve panel/mobil tarafinda "mekanlari listele" gibi ortak bir
sorgu icin iki ayri sorguyu birlestirmek gerekirdi. `VenueType { MAIN,
HOTEL }` ile tek tablo, tek liste uc noktasi (`GET /admin/venues`) yeterli;
turler arasi filtre/gruplama sadece bir `WHERE type = ...` veya panelde
istemci tarafi gruplama.

### Neden sabit alanlar yerine serbest-form Genel Bilgi bolumleri

Ilk tasarimda "Kongre Hakkinda", "Ulasim", "Duzenleme Kurulu" gibi sabit
alanlar dusunuldu, ama her kongrenin "genel bilgi" ihtiyaci farkli:
kimi vize/davetiye bilgisi ister, kimi kredi/CME puanlama aciklamasi,
kimi sponsor kurallari. Sabit alan seti ya cogu kongrede bos kalir ya da
surekli yeni alan eklemeyi gerektirir. Bunun yerine `CongressInfoSection`
serbest basliga sahip, `displayOrder` ile siralanan, Markdown govdeli
bagimsiz kayitlar - yetkili istedigi kadar/turde bolum ekleyebiliyor,
semaya dokunmadan.

### Neden `KeynoteSpeaker` bilimsel programdan (Faz 4) BAGIMSIZ

`KeynoteSpeaker`, mobil ana sayfada gosterilecek KUCUK bir vitrin
listesidir (tipik olarak 3-10 kisi) - Faz 4'te gelecek olan tam bilimsel
program/sunum (`Presentation`/`Session` konusmaci alanlari, potansiyel
olarak yuzlerce kayit) ile BILEREK iliskilendirilmedi. Ikisini
iliskilendirmek, "bu konusmaci ayni zamanda bir oturumda konusuyor mu"
gibi bir tutarlilik kisitlamasi getirirdi ve vitrin listesinin amacini
(yetkilinin elle secip one cikardigi kucuk bir grup) bozardi. Bilimsel
programdaki bir konusmaci ile ayni kisiyi vitrine eklemek istenirse ad/
unvan bilgisi elle bir kez daha girilir - kasitli bir tekrar, yanlislikla
baglanma riskine tercih edildi.

### Neden dosya sistemi, bulut depolama (S3 vb.) degil

Yuklenen gorseller (kapak, mekan, sponsor logosu, konusmaci fotografi)
kucuk hacimli (2 MB siniri) ve dusuk trafikli - ayri bir bulut depolama
servisi/SDK/kimlik bilgisi yonetimi eklemek bu olcekte gereksiz karmasiklik.
Multer disk storage + `backend/uploads/<congressId>/<uuid>.<ext>` ve
NestJS'in `useStaticAssets`'i ile dogrudan sunum yeterli. Bunun ODEDIGI
bedel: production'da konteyner yeniden olusturulunca (`docker compose up
-d --build backend`) dizin sifirlanir - bu yuzden `docker-compose.prod.yml`'a
kalici bir `backend-uploads` volume'u eklendi (bkz. `DEPLOY-REHBERI.md`
§9.5). Ileride hacim/trafik artarsa bulut depolamaya gecis, `UploadsService`
tek I/O noktasi oldugu icin izole bir degisiklik olur.

### Gorsel yukleme guvenligi: neden uzantiya degil magic-byte imzasina bakiliyor

Istemcinin gonderdigi dosya adi/uzantisi ve `Content-Type` header'i
GUVENILMEZ - bir saldirgan `.jpg` uzantili bir script yukleyip baska bir
yerde calistirmaya calisabilir. Bunun yerine dosyanin ilk birkac byte'i
(JPEG: `FF D8 FF`, PNG: `89 50 4E 47 0D 0A 1A 0A`, WEBP: `RIFF....WEBP`)
okunup gercek turu dogrulanir (`validate-image-file.ts`). Dosya adi da
HICBIR ZAMAN kullanicidan gelmez, sunucu tarafinda `randomUUID()` ile
uretilir - path traversal (`../`) ve dosya adi cakismasi/enjeksiyonu
boylece yapisal olarak imkansiz hale gelir (bkz. `resolve-upload-path.ts`,
hem "farkli" hem "uploadsRoot + path.sep ile basliyor" kontrolu birlikte).

### Bes icerik turu (Venue/Announcement/Sponsor/KeynoteSpeaker/InfoSection) neden ortak bir `ContentCrudService` uzerinden

Bes turun CRUD davranisi (kongre-scope dogrulamasi, silme/degisimde eski
gorseli diskten temizleme, `reorder` ile toplu `displayOrder` yeniden
yazimi) birebir ayni - bunu bes kez kopyalamak yerine `ContentCrudService<T>`
soyut sinifi bu ortak davranisi tasir, her tur yalnizca kendi Prisma
delege'ini, siralama kuralini ve (varsa) gorsel alanini tanimlar. Prisma'nin
uretilen delege tiplerinin (`VenueDelegate` vb.) her biri yapisal olarak
farkli ve `$transaction` toplu islemi `Prisma.PrismaPromise<T>` gerektirdigi
icin ortak arayuz (`ContentDelegate<T>`) parametre tiplerinde bilinçli olarak
gevsek (`any`) tutuldu - gercek tip guvenligi her turun kendi DTO'sunda
(controller sinirinda) zaten var, bu tek arayuz sinirindaki gevseklik
kapsamli ve yorumla belgelenmis bir tercih.

## Faz 4a — Bilimsel Program Veri Modeli ve Konusmaci Eslestirme

Eski `Session` modeli tek seviyeliydi (bir oturum, tek serbest metin
"konusmaci" alani) - gercek kongre programi iki seviyelidir: bir oturum
icinde birden fazla sunum, her sunumun kendi konusmacisi/moderatoru olur.
Bilimsel program dosyalarinda katilimci e-postasi yazmadigi icin eslestirme
**isim uzerinden** yapiliyor. Bu faz veri modelini, isim eslestirme mantigini
ve panelden elle yonetimi kurdu - PDF/Excel'den otomatik program cikarimi
Faz 4b'nin konusu.

### Neden iki seviye (Session -> Presentation), tek seviye degil

Bir oturumun (ornek: "Kardiyoloji Sempozyumu", 09:00-10:30) icinde birden
fazla bagimsiz sunum olur, her birinin kendi baslik/saat/ozet/konusmacisi
vardir. Tek seviyeli bir modelde ya her sunumu ayri bir "Session" yapmak
gerekirdi (salon/gun bilgisini her satirda tekrarlamak, oturum-duzeyi
moderatoru hicbir sunuma ait olmadan nereye koyacagini bilememek) ya da
sunumlari `Session.description` gibi bir serbest metin alanina sikistirmak
gerekirdi (yapisal sorgulanamaz, sıralanamaz, ayrica rol eslestirilemez).
`Presentation`, `Session`e `onDelete: Cascade` ile bagli ayri bir tablo
olarak eklendi - oturum silinince sunumlari da (ve onlarin rolleri de)
otomatik silinir, bu canli test edildi.

### Neden tek `ProgramRole` tablosu, `SessionRole`/`PresentationRole` diye ikiye bolunmedi

Moderator/konusmaci/tartismaci rolu davranissal olarak AYNI (isim + tur +
eslesme durumu) - tek fark hangi seviyeye bagli oldugu. Iki ayri tablo bu
ortak alanlarin tamamini tekrar ederdi ve "bir kongredeki tum rolleri
listele" (matches denetim sayfasi) gibi bir sorgu icin iki tabloyu
birlestirmek gerekirdi. Bunun yerine `ProgramRole`de `sessionId` VE
`presentationId` ikisi de nullable - bir rol ya birine ya digerine baglidir,
**ikisi birden dolu veya ikisi birden bos olamaz**. MySQL/Prisma seviyesinde
bunu zorunlu kilan bir CHECK kisiti yazilamadigi icin (Prisma CHECK
constraint desteklemiyor), bu kural `ProgramRolesService.resolveCongressId()`
icinde servis katmaninda dogrulanir (`400` doner) - hem create hem update
akisinda canli test edildi (ikisi de dolu -> 400, ikisi de bos -> 400).

### Neden bulanik/benzerlik (fuzzy) eslestirme YOK

Eslestirme yalnizca BIREBIR `searchName` esitligine bakiyor. Bulanik
eslestirme (ornek: Levenshtein mesafesi, ses benzerligi) yanlis kisiyi doğru
gibi gosterme riski tasir - katilimciya "senin sunumun şu salonda" diye
YANLIS bir bilgi göstermek, hic göstermemekten daha kotu bir kullanici
deneyimidir (sessiz veri bozulmasi). Bunun yerine sistem NET uc durumlar
uretir: `MATCHED` (tek aday), `AMBIGUOUS` (birden fazla aday - ayni isimde
iki katilimci GERCEK bir senaryo, sessizce ilk aday SECILMEZ), `UNMATCHED`
(aday yok). Belirsiz/eslesmeyen durumlarda yetkili `/sessions/matches`
sayfasindan adaylar arasindan seçip elle baglar (`MANUAL`) veya "katilimci
degil" isaretler (`IGNORED`) - bu iki durum `rematchCongress()` tarafindan
ASLA otomatik ezilmez (yetkilinin karari sabit kalir), canli test edildi.

### Neden `Session.speaker` silinmedi, yalnizca DEPRECATED isaretlendi

Faz 4a ONCESI olusmus oturumlarda bu alan dolu ve mevcut panel gorunumu
buna dayaniyordu. Alani silmek geriye donuk veri kaybina yol acardi (mutlak
kisit: "Session.speaker alanini SILME"). Yeni yazimlarda kullanilmiyor,
`CreateSessionDto`/`Session` OpenAPI semasinda `deprecated: true` olarak
isaretlendi ve panelin yeni formunda bu alana hic yer verilmedi - ama eski
veri okunabilir/gorunur kaldi.

### Neden `toLowerCase()`/`toLocaleLowerCase('tr')` yerine elle karakter esleme

`normalizeTurkishName()` Turkce harfleri (İ/I/ı -> i, Ş/ş -> s, Ğ/ğ -> g,
Ü/ü -> u, Ö/ö -> o, Ç/ç -> c) ASCII'ye indirgemeden ONCE, genel
`toLowerCase()` cagrisina GUVENMEDI. Sebep: `"İ".toLowerCase()` JS'te
platforma gore `"i"` yerine `"i̇"` (i + U+0307 birlesik nokta) uretebiliyor,
ve `"I".toLowerCase()` `Intl`/locale ayarina gore `"ı"` (noktasiz i)
verebiliyor - ikisi de arama/eslestirme icin YANLIS/tutarsiz sonuc anlamina
gelir (ayni kisi iki farkli `searchName` uretebilir). Bunun yerine bu 6 harf
cifti ELLE, tek tek ASCII karsiligina cevrilir (`TURKISH_CHAR_MAP`), SONRA
geriye kalan (artik sadece ASCII olan) metin uzerinde genel `toLowerCase()`
cagrilir - bu sıralama, platform/locale farkliliklarindan tamamen bagimsiz,
her zaman ayni sonucu ureten deterministik bir fonksiyon saglar.

### Neden `User.searchName` migration icinde degil, ayri bir betikle dolduruldu

Turkce unvan temizleme + karakter normalizasyonu SQL'de pratik degil (regex
tabanli unvan listesi + iki asamali karakter/kucultme donusumu). Migration
yalnizca nullable kolonu ekliyor (`ALTER TABLE User ADD COLUMN searchName`),
geriye donuk doldurma `backend/scripts/backfill-search-name.ts` ile
migration SONRASI bir kez calistiriliyor (bkz. `DEPLOY-REHBERI.md` §9.6).
Betik idempotent (`WHERE searchName IS NULL`) - tekrar calistirmak
guvenlidir. Yeni kullanicilar (manuel ekleme, Excel/CSV onay, pilot-login)
bu alani OLUSTURULURKEN zaten dolduruyor (bkz. `registrations.service.ts`,
`registration-import.service.ts`, `auth.service.ts`), bu yuzden betik yalnizca
GECMIS veri icin gerekli.

## Faz 4b — PDF/Excel'den Bilimsel Program Cikarimi (LLM)

Dernek bilimsel programi 100-150 sayfalik PDF/Excel olarak gonderiyor,
elle girmek gunler aliyor. Bu faz Claude API ile dosyayi yapilandirilmis
JSON'a cevirip Faz 4a'nin semasina oturtuyor - ama Faz 2'deki gibi
(yukle -> onizle/duzelt -> onayla) STAGING katmanindan geciriyor, dogrudan
canliya yazmiyor.

### Neden LLM eslestirme yapmiyor, yalnizca metin cikariyor

Gorev bilerek ikiye bolundu: LLM yalnizca belgede ne yazdigini raporlar
(isim, saat, salon adi - hepsi HAM metin); kimlik eslestirmesi (hangi
katilimci, hangi Hall, hangi gercek DateTime) tamamen backend'de,
deterministik kodla yapilir. LLM'e `userId`/`hallId`/`sessionId`
UYDURTULMAZ. Sebep Faz 4a'daki bulanik-eslestirme-yok kararinin dogal
uzantisi: bir LLM'in "muhtemelen bu kisi" diye bir isim-katilimci
eslestirmesi uydurmasi, yanlis kisiyi doğru gibi gostermek anlamina
gelir - bu, hic eslestirmemekten daha kotu bir kullanici deneyimidir.
Rol eslestirmesi icin YENI bir mantik da yazilmadi - LLM'in urettigi
`rawName` dogrudan Faz 4a'nin `ProgramRoleMatchingService.matchRole()`
servisinden gecirilir, ayni MATCHED/AMBIGUOUS/UNMATCHED ayrimi burada da
gecerlidir.

### Neden tarih/saat hesabi backend'de

LLM'den yalnizca "HH:MM" ve (belgede aciksa) "YYYY-MM-DD" istenir - gercek
bir `DateTime`'a cevirme islemi backend'de yapilir
(`derive-datetime.ts`). Bir gunun tarihi belgede yoksa kongrenin
`startDate`'inden GUN SIRASINA gore turetilir ve bu satira ACIKCA bir
uyari birakilir ("Tarih belgede yoktu, kongre baslangicindan turetildi") -
tahmini bir tarih SESSIZCE dogru gibi gosterilmez. Kongrenin `startDate`'i
de yoksa saat/tarih alanlari null birakilir, yetkili panelden elle girer.

### Neden asenkron kuyruk (BullMQ)

150 sayfalik bir PDF'te LLM cagrisi (streaming + adaptive thinking + high
effort) dakikalar surebilir - bu bir HTTP istegi icinde BEKLENEMEZ.
`POST /admin/program-imports` dosyayi hemen PENDING durumunda kuyruga
alip doner; gercek cikarim `ProgramImportQueueService`'in worker'inda
calisir (Faz 7'nin `NotificationSchedulerService`'iyle AYNI BullMQ
deseni). Buffer, is verisine (Redis job payload'ina) DOGRUDAN konmaz -
onlarca MB olabilecegi icin gecici bir dosyaya yazilip worker tarafindan
okunup silinir.

### Neden maliyet onayi zorunlu, tahmin ayri bir uc nokta

Kullanicinin API kredisi SINIRLI ($5) - kontrolsuz bir cikarim cagrisi
butceyi bitirebilir. `POST /admin/program-imports/estimate`
(`countTokens`, ucretsiz) ile `POST /admin/program-imports` (gercek
cikarim, para harcar) BILEREK iki ayri uc noktadir - panel tahmini
gosterip ACIK onay almadan ikinciyi cagirmaz. Fiyat tablosu
(`model-pricing.ts`) tek bir sabitte tutulur ve Anthropic'in resmi LISTE
fiyatlarini kullanir (tanitim/indirimli fiyat DEGIL) - tahmin her zaman
muhafazakar (yuksek) tarafta kalsin diye. Her tamamlanan cikarimda
GERCEK `inputTokens`/`outputTokens`/`estimatedCostUsd` kaydedilir; panelde
kongre bazinda toplam harcama gorunur - kullanicinin $5 butcesini takip
edebilmesi icin.

### Neden onay mevcut programin UZERINE YAZMAZ, yanina ekler

`POST /admin/program-imports/{id}/approve` mevcut Session/Presentation/
ProgramRole kayitlarini SILMEZ veya degistirmez - yalnizca staging'deki
gecerli (NEW, hallId dolu) satirlari EKLER. Ayni programi iki kez
yuklemek bu yuzden kopya uretir; bu BILINCLI bir tasarimdir (silme/
uzerine-yazma cok daha riskli bir islemdir) - panel onay diyalogunda
mevcut oturum sayisini gostererek yetkiliyi uyarir.

### Prompt injection'a karsi alinan onlem

Sistem promptu acikca belirtir: belgenin icinde Claude'a yonelik bir
talimat gibi gorunen herhangi bir metin ("yukaridaki yonergeleri yok
say" vb.) bir KOMUT olarak degil, yalnizca cikarilacak VERI olarak
degerlendirilir - belgede o sekilde yaziyorsa ilgili alana (ornegin
baslik) oldugu gibi kopyalanir, uygulanmaz. Bu, kullanicilarin
yukleyecegi belgenin icerigi tamamen guvenilmez (dernek/uçuncu taraf
kaynakli) oldugu icin gerekli bir savunmadir.

### Canli testte bulunan ve duzeltilen sorunlar

Gercek bir kongre programi (33. Ulusal Uygulamali Girisimsel Kardiyoloji
Kongresi, 90 sayfa) uzerinde yapilan canli testte, sentetik test
verisiyle yakalanamayan dort sorun bulundu:

1. **Baslik VARCHAR(191) tasmasi.** Gercek programda iki dilli (TR/EN tek
   satirda birlesik) oturum basliklari Prisma'nin varsayilan `String` ->
   MySQL `VARCHAR(191)` sinirini asti, ilk cikarim denemesi bu yuzden
   basarisiz oldu. `Session.title`, `Presentation.title`,
   `ProgramImportSession.title`, `ProgramImportPresentation.title`
   `@db.Text`'e genisletildi (`20260812000000_widen_program_titles`
   migration'i).
2. **Cikti token tahmini dusuktu.** `OUTPUT_TOKEN_ESTIMATE_RATIO` (girdi
   token sayisindan cikti tahmini turetmek icin kullanilan katsayi)
   `0.2` idi; gercek bir 25 sayfalik kesitte olculen oran ~0.36 cikti -
   tahmin gercek maliyetin ciddi altinda kaliyordu. `0.4`'e yukseltildi
   (bilerek gozlemlenenin biraz uzerinde - dusuk tahmin butceyi asip
   kullaniciyi SASIRTIR, yuksek tahmin guvenli taraftir).
   `ANTHROPIC_MAX_OUTPUT_TOKENS` varsayilani da ayni bulgu yuzunden
   `64000`'den `128000`'e cikarildi (100-150 sayfalik belgelerde
   64000'i asip cikti kesilebilir, gecersiz JSON'a yol acardi).
3. **Duzenleme formu saat alaninda 3 saatlik kayma.** Staging onizleme
   sayfasindaki oturum/sunum duzenleme formlari (`session-row.tsx`,
   `presentations-panel.tsx`), var olan bir `startTime`/`endTime`'i
   `<input type="datetime-local">` alanina doldururken ISO (UTC) metnini
   dogrudan `iso.slice(0, 16)` ile kesiyordu. `datetime-local` degeri
   tarayicinin YEREL saatini bekler - UTC metni oldugu gibi kesmek,
   Turkiye (UTC+3) saatinde 3 saatlik bir kaymaya yol aciyordu (kart
   ozetinde "14:00" gorunen bir oturum, duzenleme formunda "11:00"
   gosterilip degistirilmeden kaydedilirse SESSIZCE 11:00'e donuyordu).
   Duzeltme: `Date` nesnesinin yerel getter'lari (`getHours()` vb.)
   kullanilarak dogru YEREL saat/tarih string'i uretiliyor. Bu, projenin
   var olan yazma-yonu deseniyle (`new Date(formValue).toISOString()`,
   Faz 4a'dan beri) simetrik hale getirildi - o desen de formdan gelen
   naif tarih string'ini SUNUCUNUN yerel saat dilimine gore yorumluyor,
   bu yuzden **production sunucusunun sistem saat dilimi Europe/Istanbul
   olarak ayarlanmis olmasi gerekiyor** (bkz. `DEPLOY-REHBERI.md`) -
   aksi halde sunucu UTC calisirsa hem Faz 4a'nin hem Faz 4b'nin tum
   saat/tarih formlari yanlis yorumlanir.
4. **Onay hata mesaji hangi oturumlarin eksik oldugunu SOYLEMIYORDU.**
   Backend `approve` uc noktasi salon secilmemis oturumlari `sessions:
   [{id, title, rowOrder}]` olarak donduruyordu, ama panel bu listeyi
   kullanmiyor, yalnizca genel `message`i gosteriyordu - 29 oturumluk bir
   listede hangi 1-2 tanesinin eksik oldugunu yetkili tek tek arayip
   bulmak zorunda kaliyordu. `ApiError`e opsiyonel bir `details` alani
   eklendi (backend'in govde govdesini tasir), `approveProgramImportAction`
   artik `sessions` listesi varsa oturum basliklarini mesaja ekliyor
   ("... : OYLAMA / VOTING" gibi).

### Model karsilastirmasi (Bolum 8.4 canli testi)

Ayni 25 sayfalik kesit hem `claude-opus-4-8` hem `claude-sonnet-5` ile
cikarildi (gercek Anthropic API cagrisi, sentetik veri degil):

| | Opus 4.8 | Sonnet 5 |
|---|---|---|
| Girdi token | 61674 | 61674 |
| Cikti token | 22395 | 55068 |
| Maliyet | $0.868 | $1.011 |
| Sure | ~4.2 dk | ~11.7 dk |
| Oturum | 29 | 32 |
| Sunum | 148 | 106 |
| Rol (toplam) | 373 | 373 |

Iki modelin de temel bilimsel icerik cikarimi (baslik, salon, saat,
konusmaci adi, coklu yazar ayirma) dogruydu ve birebir orten satirlarda
BIREBIR AYNI cikti verdi. Fark yalnizca sistem promptunun "bos
Tartisma/Discussion bloklarini da ayri bir sunum olarak kaydet"
talimatina uyumda ortaya cikti: Opus bu bloklari (konusmacisiz,
sadece zaman araligi) sadik bir sekilde ayri sunum satirlari olarak
uretti, Sonnet bunlari sessizce atladi - bu yuzden Sonnet'te daha AZ
sunum sayisi var ama rol/konusmaci sayisi ikisinde de AYNI (373),
yani gercek bilimsel veri kaybi yok, yalnizca spesifikasyona tam
uyumda fark var. Sonnet ayrica paralel salonlardaki kahve arasi
bloklarini Opus'tan daha TUTARLI yakaladi (32 oturumun 3'u bu farktan
geliyor).

**Sonuc:** Sonnet 5, Opus 4.8'den hem YAVAS hem PAHALI cikti (cikti
token hacmi ~2.5 kat fazla oldugu icin, dusuk liste fiyatina ragmen).
Ayni/dengeli dogrulukla varsayilan model **`claude-opus-4-8`** olarak
KORUNDU (kullanicinin $5 butcesi goz onune alinarak da dogru secim).
