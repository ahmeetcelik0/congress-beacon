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

## Git Çalışma Düzeni

- `main`: Test edilmiş, kararlı sürümler.
- `develop`: Ortak entegrasyon branch’i.
- `feature/...`: Kişisel görev branch’leri.
- `main` ve `develop` branch’lerine doğrudan push yapılmaz.
- Her değişiklik Pull Request üzerinden kontrol edilir.
- API değişikliklerinde önce `shared/openapi.yaml` güncellenir.
