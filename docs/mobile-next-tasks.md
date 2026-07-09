# Mobil Tarafta Yapılması Gerekenler

Bu dosya, backend/panel tarafında tamamlanan Faz 5-8 işlerinin mobil tarafta karşılığı
olan, henüz yapılmamış görevleri listeler. Tüm backend endpoint'leri hazır ve test
edildi; sözleşme detayları için `shared/openapi.yaml` güncel.

---

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
