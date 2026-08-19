# Kongre Beacon

Kongrelerde salon yoğunluğunu ve katılımcıların salonlarda tahmini kalış
sürelerini, mobil uygulama ve Minew E7 iBeacon cihazlarıyla otomatik olarak
ölçen sistem. Ne işe yaradığına dair kısa, teknik-olmayan bir tanıtım için
bkz. [`docs/URUN.md`](docs/URUN.md).

## Teknolojiler

| Bileşen | Teknoloji |
|---|---|
| Mobil uygulama | Flutter (iOS) |
| Backend | NestJS + TypeScript |
| Yetkili paneli | Next.js 16 + TypeScript |
| Veritabanı | MySQL + Prisma |
| Arka plan işleri | Redis + BullMQ |
| API sözleşmesi | REST + OpenAPI (`shared/openapi.yaml`) |
| Beacon donanımı | Minew E7, iBeacon |

## Dizin yapısı

```
backend/   NestJS API - kimlik, kongre/salon/beacon/program yönetimi,
           salon tespit algoritması, bildirimler, e-posta
web/       Next.js yetkili paneli
mobile/    Flutter katılımcı uygulaması
shared/    Backend + panel arasında paylaşılan sözleşmeler
           (openapi.yaml, kanonik program şeması)
docs/      Mimari, algoritma, kararlar, kurulum, ürün dokümanları
```

## Hızlı başlangıç

Geliştirme ortamını ayağa kaldırma ve production deploy adımları için bkz.
[`docs/KURULUM.md`](docs/KURULUM.md). Kısaca:

```bash
# 1) MySQL + Redis
cp .env.example .env && docker compose up -d

# 2) Backend (port 3001)
cd backend && cp .env.example .env && npm install
npx prisma generate && npx prisma migrate deploy && npm run start:dev

# 3) Panel (port 3000)
cd web && cp .env.example .env.local && npm install && npm run dev

# 4) Mobil
cd mobile && flutter pub get
flutter run -d <cihaz-id> --dart-define=API_BASE_URL=http://<bilgisayar-ip>:3001
```

## Dokümanlar

- [`docs/URUN.md`](docs/URUN.md) — ürün tanıtımı: problem, çözüm, kimin için
- [`docs/MIMARI.md`](docs/MIMARI.md) — sistem mimarisi, bileşenler, veri
  akışı, kimlik/yetkilendirme
- [`docs/ALGORITMA.md`](docs/ALGORITMA.md) — salon tespit algoritması
- [`docs/KARARLAR.md`](docs/KARARLAR.md) — mimari kararlar ve gerekçeleri
- [`docs/KURULUM.md`](docs/KURULUM.md) — geliştirme ortamı + production
  deploy
- [`shared/openapi.yaml`](shared/openapi.yaml) — API sözleşmesi (tek kaynak)

## Çalışma düzeni

- `main`: test edilmiş, kararlı sürümler.
- `develop`: ortak entegrasyon branch'i.
- `feature/...`/`fix/...`/`chore/...`: tek görev için branch.
- `main` ve `develop`'a doğrudan push yapılmaz; her değişiklik Pull Request
  ile kontrol edilir.
- API değişikliklerinde önce `shared/openapi.yaml` güncellenir.
