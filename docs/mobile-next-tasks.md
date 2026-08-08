# Mobil Tarafta Yapılması Gerekenler

Bu dosya, backend/panel tarafında tamamlanan Faz 5-8 işlerinin mobil tarafta karşılığı
olan, henüz yapılmamış görevleri listeler. Tüm backend endpoint'leri hazır ve test
edildi; sözleşme detayları için `shared/openapi.yaml` güncel.

---

## 0) Production API adresi (ÖNEMLİ — güncelleme)

Backend artık gerçek sunucuda, HTTPS ile canlı:

```
https://beacon.photofocustr.com/api
```

- Mobil uygulamadaki base URL artık `http://localhost:3001` veya eski geliştirme
  adresi **değil**, yukarıdaki adres olmalı. Örn. `POST /auth/login` için tam adres:
  `https://beacon.photofocustr.com/api/auth/login`.
- Not: tüm endpoint yollarının başına `/api` eklendi (`API_PREFIX` konfigürasyonu).
  `shared/openapi.yaml`'daki path'ler önekssiz yazılı (ör. `/auth/login`) — mobil
  tarafta base URL'e bu prefix'i sen ekleyeceksin: `BASE_URL = https://beacon.photofocustr.com/api`.
- Yetkili paneli de canlıda: `https://beacon.photofocustr.com/yetkili` (bu adres
  sana gerekmiyor, sadece bilgi amaçlı).
- Sertifika Let's Encrypt üzerinden otomatik alındı/yenileniyor, ekstra bir ayar
  gerekmiyor; `https://` zorunlu, `http://` istekleri otomatik yönlendirilmiyor.
- Şu an production veritabanı boş — kongre/salon/beacon test verisi panelden
  yeniden oluşturulacak. Yeni test verisi (UUID'ler) oluşturulunca ayrıca haber
  vereceğim, eski PILOT1 test verisiyle eşleşmeyecek.

---

## 0.5) Yeni kimlik modeli ve giriş akışı (Faz 1 — henüz mobilde bağlanmadı)

Backend tarafında katılımcı kimliği artık tek bir kongreye kilitli değil:
kullanıcı e-posta/telefon + şifre ile giriş yapıp **kayıtlı olduğu kongreler**
arasından birini seçebiliyor ve profilinden kongre değiştirebiliyor. Bu, Faz 6
(mobil tarafta yeni giriş ekranları) için backend hazırlığıdır — mobil kod
bu fazda **değişmedi**, `pilot-login` hâlâ eskisi gibi çalışıyor.

Yeni uç noktalar (tam sözleşme için `shared/openapi.yaml`, `Auth` tag'i):

- `POST /auth/register-request` — `{ emailOrPhone }`: dernek kayıt sistemi
  üzerinden (Faz 2) zaten bir kongreye kaydı olan ama henüz şifresi olmayan
  katılımcı için 6 haneli bir kod üretir, e-postaya gönderir.
- `POST /auth/login` — `{ emailOrPhone, password }`: `{ accessToken,
  mustChangePassword, user, congresses }` döner. Dönen token'da
  `activeCongressId` **null**'dur.
- `GET /auth/me` — token doğrulama + profil/kongre listesi tazeleme
  (Faz 6'da uygulama her açılışta bunu çağıracak).
- `POST /auth/change-password` — `{ currentPassword, newPassword }`: yeni bir
  `accessToken` döner (aynı aktif kongre seçimiyle).
- `POST /auth/forgot-password` — `register-request` ile aynı akış.
- `GET /auth/my-congresses` — kullanıcının aktif kayıtlı olduğu kongreler.
- `POST /auth/select-congress` — `{ congressId }`: o kongrede aktif kaydı
  varsa `activeCongressId` dolu yeni bir `accessToken` döner.

**Faz 6'da mobil tarafta yapılacaklar (bu fazın kapsamında değil, ileriye
dönük not):** giriş/kod-doğrulama/kongre-seçim ekranları, `pilot-login`
yerine bu akışa geçiş, token'da `activeCongressId` boşsa (kongre seçilmemiş)
veya `mustChangePassword=true` ise kullanıcıyı ilgili ekrana yönlendirme.
**`pilot-login` Faz 6'da bu akış devreye girdiğinde kaldırılacak** — o zamana
kadar TestFlight'taki mevcut sürüm için geçiş köprüsü olarak duruyor, hâlâ
çalışıyor ve değişmedi.

---

## 0.6) Mobil okuma API'leri (Faz 5 — henüz mobilde bağlanmadı, Faz 6'nın konusu)

Ana sayfa, bilimsel program ve profil ekranlarının ihtiyaç duyduğu **tüm**
okuma uçları backend'de hazır ve test edildi. Tam sözleşme için
`shared/openapi.yaml`'daki `Mobile` tag'i (`operationId`ler `getMobile...`
ile başlar) — burası yalnızca **hangi ucun hangi ekranı besleyeceğinin**
özeti.

**Ortak kurallar:**
- Hepsi katılımcı JWT'si + seçili aktif kongre gerektirir
  (`Authorization: Bearer <accessToken>`, token'da `activeCongressId` dolu
  olmalı — bkz. §0.5). `congressId` **hiçbirinde** query/body parametresi
  olarak gönderilmez, backend token'dan okur.
- Her yanıtta bir `generatedAt` (ISO 8601, UTC) alanı var — önbelleğin ne
  kadar eski olduğunu göstermek için kullanılabilir.
- Tüm tarihler **UTC ISO 8601** (`...Z` sonekli) — cihazın kendi saat
  dilimine göre yerelleştirme mobil tarafın işi.
- `GET /mobile/program`, `ETag`/`If-None-Match` destekler: yanıtın `ETag`
  header'ını sakla, bir sonraki çağrıda `If-None-Match` header'ı olarak
  geri gönder — program değişmediyse gövdesiz `304` döner (indirme/parse
  atlanabilir).
- `GET /mobile/bootstrap` (beacon config) bu listede **yok** — o zaten
  bağlı, değişmedi, hâlâ auth gerektirmiyor.

### Mobil ekran → uç nokta eşlemesi

| Ekran / bileşen | Uç nokta | Not |
|---|---|---|
| Ana Sayfa — kongre kartı (tam ad, tarih aralığı, mekan, kapak görseli) | `GET /mobile/home` → `congress` | `coverImageUrl` zaten mutlak URL |
| Ana Sayfa — 6 içerik butonunun rozetleri (kaç duyuru/sponsor/konuşmacı/mekan/genel-bilgi-bölümü/oturum) | `GET /mobile/home` → `counts` | Tek istekte hepsi |
| Ana Sayfa — "okunmamış duyuru" rozeti | `GET /mobile/home` → `announcements.hasPinned` / `latestPublishedAt` | "Okunmamış" durumu sunucuda tutulmuyor — mobil bunu kendi yerel "son görüleni" ile kıyaslar (bkz. `docs/decisions.md` Faz 5) |
| Ana Sayfa — "Sıradaki Sunumum" kartı | `GET /mobile/home` → `myNextSession` (null olabilir) | `isOngoing:true` ise "Şu an devam ediyor" gibi bir etiket gösterilebilir |
| Bilimsel Program — gün sekmeleri | `GET /mobile/program/days` | Kronolojik sırada, alfabetik değil |
| Bilimsel Program — oturum listesi (gün/salon filtresi) | `GET /mobile/program?day=&hallId=` | Filtresiz çağrı TÜM programı döner — ilk açılışta bunu çekip yerelde önbellekle, sonraki açılışlarda ETag ile doğrula |
| Bilimsel Program — arama (konuşmacı/saat/salon/başlık) | `GET /mobile/program?search=` | Sunum başlığı + salon adı + konuşmacı adında (`rawName`) arar |
| Bilimsel Program — oturum detay ekranı | `GET /mobile/program/sessions/{id}` | Başka kongrenin ID'si denenirse 404 |
| Profilim — kişisel bilgiler, kongre listesi | `GET /auth/me` (Faz 1, YENİ değil) | Ayrı bir mobil uç YOK, mevcut olan kullanılır |
| Profilim — "Benim Programım" (kendi konuşma/moderatörlük listem) | `GET /mobile/my-program` | Kronolojik, `roleType` alanıyla (MODERATOR/SPEAKER/DISCUSSANT) etiketlenebilir |
| Duyurular ekranı | `GET /mobile/announcements` | Yalnızca yayınlanmış, sabitlenmiş önce |
| Sponsorlar ekranı | `GET /mobile/sponsors` | Prestij sırası (PLATINUM→SUPPORTER) sonra elle sıra |
| Ana Konuşmacılar ekranı | `GET /mobile/speakers` | `photoUrl` mutlak URL |
| Otel/Mekan ekranı | `GET /mobile/venues` | Ana mekan (`type=MAIN`) listenin başında |
| Genel Bilgi ekranı | `GET /mobile/info-sections` | `body` Markdown, mobilde render edilmeli |

**Kapsam dışı (bu fazda yapılmadı, ileriye dönük not):** favori/takvime
ekleme, bildirim tercihleri, katılımcının salon/beacon geçmişi (hiçbir
mobil uçta bu bilgi yok ve olmayacak — bkz. `docs/decisions.md`).

## 1) Push token gönderimi (Faz 7)

Backend'de yeni endpoint hazır:

```
PUT /devices/push-token
Authorization: Bearer <katilimci JWT>
{
  "deviceId": "<devices/register'dan donen id>",
  "pushToken": "<FCM/APNs token>"
}
```

- Katılımcı giriş yapıp cihaz kaydı (`POST /devices/register`) tamamlandıktan sonra,
  FCM/APNs'ten token alındığında (veya token yenilendiğinde) bu endpoint çağrılmalı.
- `deviceId`, cihaza ait olmalı — başka bir kullanıcının cihazına yazmaya çalışırsan
  `403` döner.
- **Firebase projesi henüz kurulmadı** — biz (backend tarafı) Firebase Cloud Messaging
  projesini oluşturup service-account bilgilerini paylaşana kadar bu entegrasyonu
  başlatmana gerek yok, ama kodun bu endpoint'i çağıracak şekilde hazır olması iyi olur.
  FCM iOS tarafında APNs token'ını otomatik olarak Firebase'e köprüler, yani ayrıca
  ham bir APNs entegrasyonu yazmana gerek yok — sadece `firebase_messaging` paketiyle
  alınan token'ı bu endpoint'e göndermen yeterli.

## 2) Bildirime dokununca deep link + analitik (Faz 7)

- Backend, her oturumdan **10 dakika önce** o kongredeki tüm (push token'ı olan)
  cihazlara bir bildirim gönderiyor (şu an gerçek gönderim yok, bkz. not aşağıda —
  ama veri modeli ve zamanlama tam çalışıyor).
- Bildirim payload'ında `sessionId` bulunacak şekilde FCM mesajına `data` alanı
  eklenecek (bu kısmı biz FCM entegrasyonunu kurarken netleştireceğiz).
- Kullanıcı bildirime dokununca:
  1. İlgili oturumun salonuna/ekranına deep-link ile yönlendir.
  2. `POST /notifications/opened` çağır: `{ "notificationLogId": "<bildirimle birlikte gelen id>" }`
     — bu, panelde bildirim açılma analitiğini besleyecek.

**Önemli not — şu an gerçek bildirim gönderilmiyor:** Backend'de `NotificationSender`
soyutlaması var; Firebase kimlik bilgisi olmadığı için şu an yalnızca sunucu loglarına
yazıyor. Biz Firebase projesini kurup gerçek gönderimi bağladığımızda mobil tarafta
**hiçbir değişiklik gerekmeyecek** — sözleşme (payload şekli) aynı kalacak.

## 3) Arka plan / force-quit konusu — şimdilik beklemede

> **Güncellik notu:** Aşağıdaki "arka planda çalışıyor" doğrulaması, commit
> `6990447` (duty-cycle patch'i) **öncesine** ait. O patch arka plan veri
> akışını kırmıştı; düzeltme ve güncel test protokolü için
> `docs/mobile-handoff.md`'deki **"2026-07-17 (devam) — Arka Plan Ranging
> Regresyon Düzeltmesi"** bölümüne bakın.

Bugünkü pilot testte doğruladık: uygulama arka planda veya ekran kilitliyken
`monitoring()` + `UIBackgroundModes` sayesinde çalışıyor; kullanıcı uygulamayı elle
kapattığında (force-quit) hiçbir mekanizma çalışmıyor ve bu, Apple'ın kasıtlı,
atlatılamaz platform kısıtlaması. Bunu ileride (headless relaunch + otomatik
gözlem servisi devam ettirme deseni) tekrar konuşacağız — şimdilik bu konuda ek
bir mobil görev yok, aksiyon bekletiliyor.

## 4) Bilgi amaçlı hatırlatma (öncelik değil)

- `mobile/lib/main.dart` içindeki eski `BeaconTestPage` (client-side sahte salon
  kararı üreten test ekranı) hâlâ `ParticipantHomePage`'ten bir buton ile erişilebilir
  durumda. Gerçek pilot katılımcılarının eline geçmeden önce bu butonun
  gizlenmesi/kaldırılması senin kararına bağlı — arkadaki gerçek veri akışını
  etkilemiyor, sadece kafa karıştırabilir.
- Konum izninin cihazda gerçekten **"Her Zaman"** olarak ayarlı olduğunu (sadece
  "Uygulamayı Kullanırken" değil) test öncesi bir kez daha kontrol etmekte fayda var.

---

## Referans

- Güncel API sözleşmesi: `shared/openapi.yaml` (yeni path'ler: `/devices/push-token`,
  `/notifications/opened`, `/sessions`).
- Backend'deki ilgili kod: `backend/src/notifications/`, `backend/src/session/`,
  `backend/src/devices/`.
