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
