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
- [ ] Bu README ve `CLAUDE.md` `develop` branch'ine merge edildi.

### Mobil geliştirici

- [x] Mevcut Flutter beacon test projesi `mobile/` klasörüne taşındı.
- [ ] Mobil proje PR'ı `develop` branch'ine merge edildi.
- [ ] `mobile/` projesi repo içinden gerçek iPhone'da tekrar çalıştırıldı.

### Backend / panel geliştiricisi

- [ ] `CLAUDE.md` dosyası repo köküne eklendi.
- [ ] Backend geliştirici `feature/backend-project-setup` branch'ini oluşturdu.

**Faz 0 tamamlanma koşulu:** İki bilgisayarda da `develop` güncel; mobil proje repodan çalışıyor; backend geliştirici kendi branch'ine hazır.

---

## Faz 1 — Backend, veritabanı ve panel iskeleti

### Mobil geliştirici

- [ ] Backend'in hazırladığı API adresi için mobil yapılandırma yaklaşımı belirlendi.
- [ ] Mobilde API katmanı için boş klasör yapısı hazırlandı: `lib/core/`, `lib/features/`, `lib/models/`.
- [ ] Mevcut beacon test ekranı üretim ekranından ayrılacak şekilde planlandı.

### Backend / panel geliştiricisi

- [ ] `backend/` içinde NestJS projesi oluşturuldu.
- [ ] `web/` içinde Next.js projesi oluşturuldu.
- [ ] Kök dizinde `docker-compose.yml` oluşturuldu.
- [ ] Docker Compose içine MySQL eklendi.
- [ ] Docker Compose içine Redis eklendi.
- [ ] Prisma kuruldu ve MySQL bağlantısı yapıldı.
- [ ] `GET /health` endpoint'i eklendi.
- [ ] Backend `.env.example` oluşturuldu.
- [ ] Web `.env.example` oluşturuldu.
- [ ] Backend ve panel için çalışma komutları README'ye eklendi.
- [ ] Backend kurulumu test edildi.
- [ ] Panel kurulumu test edildi.
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

- [ ] Prisma modelleri oluşturuldu: `Congress`, `Hall`, `Beacon`, `HallBeacon`.
- [ ] Migration oluşturuldu.
- [ ] Kongre CRUD API'leri yazıldı.
- [ ] Salon CRUD API'leri yazıldı.
- [ ] Beacon CRUD API'leri yazıldı.
- [ ] Beacon-salon eşleştirme API'si yazıldı.
- [ ] Panelde kongre yönetimi ekranı yapıldı.
- [ ] Panelde salon yönetimi ekranı yapıldı.
- [ ] Panelde beacon yönetimi ekranı yapıldı.
- [ ] `GET /mobile/bootstrap` endpoint'i yazıldı.
- [ ] Bootstrap endpoint'i OpenAPI dosyasına eklendi.

### Ortak entegrasyon

- [ ] Mobil bootstrap response sözleşmesi onaylandı.
- [ ] Mobil mock veri yerine bootstrap endpoint'ini kullanıyor.
- [ ] Panelden test kongresi oluşturuldu.
- [ ] Salon 1 ve Salon 2 oluşturuldu.
- [ ] Test beacon'ları salonlara bağlandı.

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

- [ ] `Device` modeli oluşturuldu.
- [ ] `PresenceObservation` modeli oluşturuldu.
- [ ] Observation source enum'ları eklendi.
- [ ] `POST /devices/register` endpoint'i yazıldı.
- [ ] `POST /observations/batch` request/response sözleşmesi hazırlandı.
- [ ] JWT mobil doğrulama altyapısı başlatıldı.
- [ ] OpenAPI observation şeması güncellendi.

### Ortak entegrasyon

- [ ] Observation JSON alanları kesinleştirildi.
- [ ] Mobil cihaz kaydı yapıyor.
- [ ] Mobil foreground observation üretiyor.
- [ ] Örnek observation backend DTO doğrulamasından geçiyor.

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

- [ ] Foreground/background kaynakları raporlamada ayrıldı.
- [ ] Katılımcı takip sağlığı hesaplandı.
- [ ] `GET /admin/tracking-health` endpoint'i yazıldı.
- [ ] Panelde takip sağlığı ekranı yapıldı.
- [ ] Aktif / sadece arka plan / veri yok / izin sorunu olası durumları eklendi.

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

- [ ] `AttendanceInterval` modeli oluşturuldu.
- [ ] Observation'ları zaman sırasına koyan servis yazıldı.
- [ ] Aynı salon observation'larını birleştirme kuralı yazıldı.
- [ ] Salon geçiş kuralı yazıldı.
- [ ] Uzun veri boşluğu `unknown` kabul ediliyor.
- [ ] Çok kısa observation'lar filtreleniyor.
- [ ] Oturum zamanlarıyla salon aralıkları eşleştiriliyor.
- [ ] Katılım yüzdesi hesaplanıyor.
- [ ] Ortalama ve medyan kalış süresi hesaplanıyor.
- [ ] Güven seviyesi hesaplanıyor.
- [ ] Panelde katılımcı salon geçmişi gösteriliyor.

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

- [ ] `Session` modeli oluşturuldu.
- [ ] Oturum-salon ilişkisi oluşturuldu.
- [ ] Bilimsel program yönetim ekranı yapıldı.
- [ ] Push token endpoint'i yazıldı.
- [ ] Redis/BullMQ bildirim planlayıcısı kuruldu.
- [ ] Oturumdan 10 dakika önce bildirim kuralı eklendi.
- [ ] Oturum başlangıç bildirimi eklendi.
- [ ] Program değişikliği bildirimi eklendi.
- [ ] Bildirim frekans limiti eklendi.
- [ ] Bildirim gönderim/açılma analitiği eklendi.

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

- [ ] Kongre özeti dashboard'u yapıldı.
- [ ] Salon bazlı tahmini kişi sayısı ekranı yapıldı.
- [ ] Oturum bazlı katılım ekranı yapıldı.
- [ ] Ortalama/medyan kalış süresi ekranı yapıldı.
- [ ] Zaman dilimine göre yoğunluk grafikleri yapıldı.
- [ ] Veri kalite oranı ekranı yapıldı.
- [ ] Beacon sağlık ekranı yapıldı.
- [ ] CSV export eklendi.
- [ ] Excel export eklendi.
- [ ] PDF rapor export eklendi.
- [ ] Rol/yetki sistemi tamamlandı.
- [ ] Audit log eklendi.

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
