# Kongre Beacon Sistemi

Kongrelerde salon yoğunluğunu ve katılımcıların salonlarda tahmini kalış sürelerini, mobil uygulama ve Minew E7 iBeacon cihazlarıyla analiz eden sistem.

## Teknolojiler

- Mobil: Flutter
- Backend: NestJS + TypeScript
- Yetkili paneli: Next.js + TypeScript
- Veritabanı: MySQL + Prisma
- Arka plan işleri: Redis + BullMQ
- Beacon: Minew E7, iBeacon
- API: REST + OpenAPI

## Çalışma düzeni

- `main`: test edilmiş kararlı sürüm
- `develop`: ortak entegrasyon branch'i
- `feature/...`: tek görev için kişisel çalışma branch'i
- `main` ve `develop` üzerine doğrudan push yapılmaz.
- Her tamamlanan görev için Pull Request açılır; diğer geliştirici kontrol edip `develop`e merge eder.
- Ortak API değişikliklerinde önce `shared/openapi.yaml` güncellenir.
- Her iş başlangıcında ve merge sonrasında `develop` güncellenir.

## Günlük Git kısa akışı

```bash
cd ~/Desktop/congress-beacon
git checkout develop
git pull origin develop
git checkout -b feature/gorev-adi
```

Çalışma sonunda:

```bash
git status
git add <dosya-veya-klasor>
git commit -m "feat: gorev aciklamasi"
git push -u origin feature/gorev-adi
```

GitHub'da PR açılır:

```text
feature/gorev-adi -> develop
```

PR merge olduktan sonra:

```bash
git checkout develop
git pull origin develop
```

## Backend ve Panel Çalıştırma

Servisleri başlatma sırası:

1. MySQL ve Redis'i ayağa kaldır (kök dizinde):

   ```bash
   cp .env.example .env
   docker compose up -d
   docker compose ps
   ```

2. Backend (NestJS, varsayılan port `3001`):

   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run start:dev
   ```

   Sağlık kontrolü: `curl http://localhost:3001/health` → `{"status":"ok"}`

3. Panel (Next.js, varsayılan port `3000`):

   ```bash
   cd web
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Tarayıcıda: `http://localhost:3000`

**Not:** `3000`/`3001` portları yerelde başka bir uygulamayla çakışırsa, ilgili `.env`/`.env.local` dosyasındaki `PORT` / `NEXT_PUBLIC_API_URL` değerini güncelleyin (panel `next dev -p <port>` ile de başlatılabilir).

---

# Sıralı Proje Checklist'i

> Kural: Bir madde tamamlanınca `[ ]` yerine `[x]` yazın.  
> Bir fazın tüm zorunlu maddeleri bitmeden sonraki faza geçmeyin.

## Faz 0 — Ortak başlangıç ve ortam

### Ortak

- [x] GitHub private repo oluşturuldu.
- [x] `main` ve `develop` branch'leri oluşturuldu.
- [x] İki geliştirici repoya erişebiliyor.
- [x] Ortak klasör yapısı oluşturuldu: `mobile/`, `backend/`, `web/`, `shared/`, `docs/`.
- [x] `.gitignore` eklendi.
- [x] `docs/decisions.md` Türkçe proje kararları ile oluşturuldu.
- [ ] GitHub Project / Issues panosu oluşturuldu.
- [ ] Etiketler oluşturuldu: `mobile`, `backend`, `web`, `database`, `beacon`, `ios`, `integration`, `bug`.
- [x] Bu README `develop` branch'ine merge edildi. `CLAUDE.md` ekip kararıyla repoya commit edilmiyor (bkz. kök `.gitignore`); içeriği gerekirse repo dışında paylaşılır.

### Mobil geliştirici

- [x] Mevcut Flutter beacon test projesi `mobile/` klasörüne taşındı.
- [ ] Mobil proje PR'ı `develop` branch'ine merge edildi.
- [ ] `mobile/` projesi repo içinden gerçek iPhone'da tekrar çalıştırıldı.

### Backend / panel geliştiricisi

- [x] `CLAUDE.md` dosyası repo köküne eklendi (repoya commit edilmiyor, bkz. not yukarıda).
- [x] Backend geliştirici `feature/backend-project-setup` branch'ini oluşturdu.

**Faz 0 tamamlanma koşulu:** İki bilgisayarda da `develop` güncel; mobil proje repodan çalışıyor; backend geliştirici kendi branch'ine hazır.

---

## Faz 1 — Backend, veritabanı ve panel iskeleti

### Mobil geliştirici

- [ ] Backend'in hazırladığı API adresi için mobil yapılandırma yaklaşımı belirlendi.
- [ ] Mobilde API katmanı için boş klasör yapısı hazırlandı: `lib/core/`, `lib/features/`, `lib/models/`.
- [ ] Mevcut beacon test ekranı üretim ekranından ayrılacak şekilde planlandı.

### Backend / panel geliştiricisi

- [x] `backend/` içinde NestJS projesi oluşturuldu.
- [x] `web/` içinde Next.js projesi oluşturuldu.
- [x] Kök dizinde `docker-compose.yml` oluşturuldu.
- [x] Docker Compose içine MySQL eklendi.
- [x] Docker Compose içine Redis eklendi.
- [x] Prisma kuruldu ve MySQL bağlantısı yapıldı.
- [x] `GET /health` endpoint'i eklendi.
- [x] Backend `.env.example` oluşturuldu.
- [x] Web `.env.example` oluşturuldu.
- [x] Backend ve panel için çalışma komutları README'ye eklendi.
- [x] Backend kurulumu test edildi.
- [x] Panel kurulumu test edildi.
- [ ] Faz 1 PR'ı açıldı.

### Ortak entegrasyon

- [ ] Backend/panel PR'ı gözden geçirildi.
- [ ] Backend/panel PR'ı `develop`e merge edildi.
- [ ] İki geliştirici `develop` branch'ini güncelledi.
- [ ] `/health` endpoint'i iki bilgisayardan test edildi.

**Faz 1 tamamlanma koşulu:** MySQL ve Redis Docker ile çalışıyor; backend ve panel açılıyor; `/health` cevap veriyor.

---

## Faz 2 — Kongre, salon ve beacon yönetimi

### Mobil geliştirici

- [ ] Minew E7 beacon UUID, Major, Minor değerleri `docs/beacon-standard.md` dosyasına işlendi.
- [ ] RSSI `0 dBm` değerleri filtrelendi.
- [ ] Birden fazla beacon tarama testi yapıldı.
- [ ] Salon bazlı beacon listesi desteği hazırlandı.
- [ ] Mock salon/beacon konfigürasyonu hazırlandı.

### Backend / panel geliştiricisi

- [x] Prisma modelleri oluşturuldu: `Congress`, `Hall`, `Beacon`, `HallBeacon`.
- [x] Migration oluşturuldu.
- [x] Kongre CRUD API'leri yazıldı.
- [x] Salon CRUD API'leri yazıldı.
- [x] Beacon CRUD API'leri yazıldı.
- [x] Beacon-salon eşleştirme API'si yazıldı.
- [x] Panelde kongre yönetimi ekranı yapıldı.
- [x] Panelde salon yönetimi ekranı yapıldı.
- [x] Panelde beacon yönetimi ekranı yapıldı.
- [x] `GET /mobile/bootstrap` endpoint'i yazıldı.
- [x] Bootstrap endpoint'i OpenAPI dosyasına eklendi.

### Ortak entegrasyon

- [ ] Mobil bootstrap response sözleşmesi onaylandı.
- [ ] Mobil mock veri yerine bootstrap endpoint'ini kullanıyor.
- [x] Panelden test kongresi oluşturuldu.
- [x] Salon 1 ve Salon 2 oluşturuldu.
- [x] Test beacon'ları salonlara bağlandı.

**Faz 2 tamamlanma koşulu:** Panelde tanımlanan beacon/salon ayarları mobil uygulamaya API ile geliyor.

---

## Faz 3 — Salon kararı ve observation sözleşmesi

### Mobil geliştirici

- [ ] Salon bazlı RSSI ortalaması veya medyanı hesaplandı.
- [ ] Başlangıç salon içi eşiği `-70 dBm` uygulandı.
- [ ] İki salon aynı anda görünürse güçlü sinyal karşılaştırması eklendi.
- [ ] Kararsız durum için `unknown` üretildi.
- [ ] Salon değişimi için doğrulama süresi eklendi.
- [ ] Kısa sinyal sıçramaları filtrelendi.
- [ ] `PresenceObservation` modeli oluşturuldu.
- [ ] Debug ekranda karar geçmişi gösterildi.

### Backend / panel geliştiricisi

- [x] `Device` modeli oluşturuldu.
- [x] `PresenceObservation` modeli oluşturuldu (`ObservationBatch` + `BeaconObservation` olarak; ayrıca `AttendanceEvent`/`HallVisit` ile salon karari backend'de uretiliyor — bkz. `docs/decisions.md`).
- [ ] Observation source enum'ları eklendi. (Mimari karari geregi mobil kaynak/confidence bilgisi göndermiyor, yalnizca ham RSSI; bkz. `docs/decisions.md`.)
- [x] `POST /devices/register` endpoint'i yazıldı.
- [x] `POST /observations/batch` request/response sözleşmesi hazırlandı (gercek ingestion dahil, bkz. Faz notlari).
- [x] JWT mobil doğrulama altyapısı başlatıldı (pilot-login, access token).
- [x] OpenAPI observation şeması güncellendi.

### Ortak entegrasyon

- [ ] Observation JSON alanları kesinleştirildi. (Backend tarafinda sabit; mobil gelistiriciyle (Ahmet) karsilikli onay bekleniyor.)
- [ ] Mobil cihaz kaydı yapıyor.
- [ ] Mobil foreground observation üretiyor.
- [x] Örnek observation backend DTO doğrulamasından geçiyor. (curl ile gercek batch gonderilip dogrulandi.)

**Faz 3 tamamlanma koşulu:** Mobil ve backend aynı observation sözleşmesini kullanıyor.

---

## Faz 4 — Offline kuyruk ve observation kayıt API'si

### Mobil geliştirici

- [ ] Drift veya SQLite kuruldu.
- [ ] Yerel observation tablosu oluşturuldu.
- [ ] Her observation için `idempotencyKey` üretildi.
- [ ] Observation önce yerel veritabanına yazılıyor.
- [ ] Online iken batch gönderim yapılıyor.
- [ ] Offline iken observation kuyrukta tutuluyor.
- [ ] Başarılı gönderimler `synced` işaretleniyor.
- [ ] Retry sayısı tutuluyor.
- [ ] Uygulama açılışında senkronizasyon yapılıyor.
- [ ] Debug ekranda kuyruk sayısı gösteriliyor.

### Backend / panel geliştiricisi

- [ ] `POST /observations/batch` endpoint'i tamamlandı.
- [ ] JWT doğrulaması eklendi.
- [ ] Cihaz-kullanıcı ilişkisi doğrulanıyor.
- [ ] `idempotencyKey` unique kuralı eklendi.
- [ ] Tekrar gönderilen kayıt duplicate oluşturmuyor.
- [ ] Hatalı batch kayıtları ayrı dönüyor.
- [ ] Device time ve server receive time saklanıyor.
- [ ] Panelde ham observation listesi eklendi.
- [ ] Observation filtreleri eklendi.

### Ortak entegrasyon

- [ ] İnternet kapalıyken en az 20 observation üretildi.
- [ ] Uygulama kapatılıp açıldı; kuyruk korundu.
- [ ] İnternet açıldı; observation'lar gönderildi.
- [ ] Aynı batch tekrar gönderildi; duplicate oluşmadı.
- [ ] Panelde ham observation kayıtları göründü.

**Faz 4 tamamlanma koşulu:** Offline veriler kaybolmadan backend'e aktarılıyor.

---

## Faz 5 — iOS arka plan iBeacon monitoring

### Mobil geliştirici

- [ ] iOS Bluetooth, konum ve arka plan izin metinleri kontrol edildi.
- [ ] Always Allow konum izin akışı eklendi.
- [ ] Background Modes ayarları yapıldı.
- [ ] Swift CoreLocation servis katmanı eklendi.
- [ ] Flutter-Swift EventChannel kuruldu.
- [ ] iBeacon region monitoring başlatıldı.
- [ ] `didEnterRegion` olayı observation olarak kaydediliyor.
- [ ] `didExitRegion` olayı observation olarak kaydediliyor.
- [ ] Uygulama öne gelince kısa ranging doğrulaması yapılıyor.
- [ ] Arka plan ve ekran kilidi testleri yapıldı.
- [ ] Zorla kapatma sınırı dokümante edildi.

### Backend / panel geliştiricisi

- [ ] Foreground/background kaynakları raporlamada ayrıldı. (Mimari karari geregi mobil bu bilgiyi göndermiyor; bkz. Faz 3 notu.)
- [x] Katılımcı takip sağlığı hesaplandı.
- [x] `GET /admin/tracking-health` endpoint'i yazıldı.
- [x] Panelde takip sağlığı ekranı yapıldı.
- [x] Aktif / yakın zamanda / veri yok durumları eklendi. (İzin-sorunu ayrimi mobil kaynak bilgisi olmadan yapilamiyor.)

### Ortak entegrasyon

- [ ] Background event mobil → API → panel zincirinde görüldü.
- [ ] Takip sağlığı panelde güncelleniyor.
- [ ] iOS sınırları `docs/decisions.md` dosyasına eklendi.

**Faz 5 tamamlanma koşulu:** Arka plan region olayları güvenli şekilde kaydediliyor ve panelde izleniyor.

---

## Faz 6 — Tahmini kalış süresi ve oturum katılımı

### Mobil geliştirici

- [ ] RSSI özet alanları eksiksiz gönderiliyor.
- [ ] Rakip salon bilgisi varsa gönderiliyor.
- [ ] Güven puanı hesaplaması sabitlendi.
- [ ] Uygulama durumu doğru gönderiliyor.
- [ ] Test amaçlı observation üretme aracı eklendi.

### Backend / panel geliştiricisi

- [x] `AttendanceInterval` modeli oluşturuldu. (`HallVisit` + `AttendanceEvent` olarak; bkz. `docs/decisions.md`.)
- [x] Observation'ları zaman sırasına koyan servis yazıldı. (`AttendanceProcessingService`.)
- [x] Aynı salon observation'larını birleştirme kuralı yazıldı.
- [x] Salon geçiş kuralı yazıldı.
- [x] Uzun veri boşluğu `unknown` kabul ediliyor. (BullMQ `stale-visit-sweep` repeatable job'u, 5dk veri gelmeyen acik ziyaretleri gercekten kapatip `confidenceLevel:'unknown'` isaretliyor.)
- [ ] Çok kısa observation'lar filtreleniyor. (Ardışık-2 giriş kuralı tekil sıçramaları dolaylı süzüyor ama özel bir filtre yok.)
- [ ] Oturum zamanlarıyla salon aralıkları eşleştiriliyor. (`Session` modeli artik var ama katilim eslestirme mantigi henuz yazilmadi.)
- [ ] Katılım yüzdesi hesaplanıyor.
- [x] Ortalama ve medyan kalış süresi hesaplanıyor. (`/attendance/summary`'nin `durationStats` alani, panelde "Kalış Süresi" bölümü.)
- [x] Güven seviyesi hesaplanıyor. (Giris anindaki RSSI-esik marjina göre yuksek/orta/dusuk.)
- [x] Panelde katılımcı salon geçmişi gösteriliyor. (`/attendance` sayfası — filtreli/sayfalanmış tablo.)

### Ortak entegrasyon

- [ ] 45 dakika salonda kalma testi yapıldı.
- [ ] 5 dakika girip çıkma testi yapıldı.
- [ ] Salon değiştirme testi yapıldı.
- [ ] Veri boşluğu testi yapıldı.
- [ ] Foreground + background birleşik test yapıldı.
- [ ] Sonuçlar elle beklenen sürelerle karşılaştırıldı.

**Faz 6 tamamlanma koşulu:** Ham observation verileri tahmini salon kalış aralıklarına dönüşüyor.

---

## Faz 7 — Bilimsel program ve bildirimler

### Mobil geliştirici

- [ ] Firebase Cloud Messaging kuruldu.
- [ ] iOS APNs ayarları tamamlandı.
- [ ] Bildirim izin akışı eklendi.
- [ ] Push token backend'e gönderiliyor.
- [ ] Bildirime dokununca ilgili oturum ekranı açılıyor.
- [ ] Uygulama açılınca beacon ranging başlıyor.
- [ ] Açılışta offline kuyruk senkronize oluyor.
- [ ] Bildirim açılma olayı API'ye gönderiliyor.

### Backend / panel geliştiricisi

- [x] `Session` modeli oluşturuldu.
- [x] Oturum-salon ilişkisi oluşturuldu.
- [x] Bilimsel program yönetim ekranı yapıldı. (`/sessions`.)
- [x] Push token endpoint'i yazıldı. (`PUT /devices/push-token`.)
- [x] Redis/BullMQ bildirim planlayıcısı kuruldu.
- [x] Oturumdan 10 dakika önce bildirim kuralı eklendi.
- [ ] Oturum başlangıç bildirimi eklendi. (Su an yalnizca 10dk-once hatirlaticisi var, ayrica baslangic bildirimi yok.)
- [ ] Program değişikliği bildirimi eklendi.
- [ ] Bildirim frekans limiti eklendi.
- [x] Bildirim gönderim/açılma analitiği eklendi. (`NotificationLog` + `POST /notifications/opened`; FCM/APNs kimlik bilgisi gelene kadar gonderim `LoggingNotificationSender` ile sadece loglaniyor, gercek gonderim FCM baglaninca kod degisikligi gerekmeden devreye girecek.)

### Ortak entegrasyon

- [ ] Panelden oturum oluşturuldu.
- [ ] Test bildirimi gerçek iPhone'a geldi.
- [ ] Bildirime dokununca doğru oturum açıldı.
- [ ] Açılıştan sonra beacon observation oluştu.
- [ ] Bildirim analitiği panelde göründü.

**Faz 7 tamamlanma koşulu:** Bildirim → uygulama açılışı → beacon observation zinciri çalışıyor.

---

## Faz 8 — Raporlar, kalibrasyon ve pilot test

### Mobil geliştirici

- [ ] Debug beacon ekranı üretimde gizlendi.
- [ ] İzin durumu kullanıcıya anlaşılır gösterildi.
- [ ] Takip durumu ekranı eklendi.
- [ ] Uygulama sürümü ve cihaz sağlık verisi API'ye gönderiliyor.
- [ ] Hata/crash izleme eklendi.
- [ ] iOS ve Android gerçek cihaz testleri yapıldı.

### Backend / panel geliştiricisi

- [x] Kongre özeti dashboard'u yapıldı. (`/attendance`: KPI kartları + canlı salon doluluğu.)
- [x] Salon bazlı tahmini kişi sayısı ekranı yapıldı.
- [ ] Oturum bazlı katılım ekranı yapıldı. (`Session` modeli var, ama HallVisit ile oturum eslestirme mantigi henuz yazilmadi.)
- [x] Ortalama/medyan kalış süresi ekranı yapıldı. (`/attendance` sayfasi, "Kalış Süresi" bölümü.)
- [x] Zaman dilimine göre yoğunluk grafikleri yapıldı. (Recharts, 15dk bucket'li salon bazlı seri.)
- [x] Veri kalite oranı ekranı yapıldı. (`/reports`.)
- [x] Beacon sağlık ekranı yapıldı. (`/reports`.)
- [x] CSV export eklendi. (`/reports/hall-visits.csv`.)
- [ ] Excel export eklendi. (Bilinçli olarak sonraya birakildi.)
- [ ] PDF rapor export eklendi. (Bilinçli olarak sonraya birakildi.)
- [x] Rol/yetki sistemi tamamlandı. (Basit JWT tabanli `AdminUser` girisi, tum yonetim/attendance/rapor endpoint'leri korunuyor.)
- [x] Audit log eklendi. (`AuditLog` modeli + otomatik interceptor.)

### Ortak pilot checklist'i

- [ ] Pilot kongre panelden oluşturuldu.
- [ ] Salonlar ve beacon'lar tanımlandı.
- [ ] Bilimsel program eklendi.
- [ ] En az 10 test katılımcısı uygulamayı kurdu.
- [ ] iOS ve Android birlikte test edildi.
- [ ] Salon ortası, kapı önü, koridor ve yan salon ölçümleri alındı.
- [ ] Her salonun RSSI eşiği güncellendi.
- [ ] Beacon yerleşimi gerektiğinde değiştirildi.
- [ ] Manuel sayım ile panel tahmini karşılaştırıldı.
- [ ] Veri boşluğu oranı ölçüldü.
- [ ] Bildirim açılma oranı ölçüldü.
- [ ] Kongre sonu PDF/Excel raporu kontrol edildi.
- [ ] Kritik hatalar çözüldü.
- [ ] Kararlı sürüm `main` branch'ine release olarak alındı.

## Ortak karar ve dokümanlar

- Proje kararları: `docs/decisions.md`
- Beacon standardı: `docs/beacon-standard.md`
- API sözleşmesi: `shared/openapi.yaml`
- Claude Code talimatları: `CLAUDE.md`
