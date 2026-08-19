# Kurulum

## Geliştirme ortamı

### 1. MySQL ve Redis'i ayağa kaldır (kök dizinde)

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

### 2. Backend (NestJS, varsayılan port `3001`)

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Sağlık kontrolü: `curl http://localhost:3001/health` → `{"status":"ok"}`

`backend/.env`'deki opsiyonel entegrasyonlar (`ANTHROPIC_API_KEY`,
`SMTP_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`) boş bırakılabilir — hiçbiri
uygulamayı çökertmez, ilgili özellik yalnızca loglama/`503` ile zarif
şekilde devre dışı kalır (bkz. `backend/.env.example` içindeki alan
yorumları).

### 3. Panel (Next.js, varsayılan port `3000`)

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Tarayıcıda: `http://localhost:3000`

**Not:** Portlar yerelde çakışırsa ilgili `.env`/`.env.local` dosyasındaki
`PORT`/`NEXT_PUBLIC_API_URL` değerini güncelleyin.

### 4. Mobil (Flutter)

```bash
cd mobile
flutter pub get
flutter run -d <cihaz-id> --dart-define=API_BASE_URL=http://<bilgisayar-ip>:3001
```

Gerçek cihazda test ederken bilgisayarın yerel ağ IP'si kullanılmalı
(`http://localhost:3001` telefon için erişilemez). iOS'ta arka plan beacon
takibi test edilecekse konum izninin **"Her Zaman"** olması gerekir.

`flutter test` fiziksel iOS cihazlarda varsayılan olarak her
çalıştırmadan SONRA uygulamayı cihazdan SİLER — bu, Keychain oturumunu ve
konum iznini sıfırlar. `integration_test/` çalıştırırken her zaman
`--no-uninstall` bayrağı kullanılmalı; uygulama bir kez kurulup konum izni
elle "Her Zaman İzin Ver" yapılmalı, sonraki koşular kalıcı olur.

## Production deploy

Aşağıdaki adımlar `docker-compose.prod.yml` + `Caddyfile` ile tek bir
sunucuda (Docker Compose) deploy içindir. Caddy, TLS sertifikasını
Let's Encrypt'ten otomatik alır ve `/api/*`'yi backend'e, `/yetkili*`'yi
panele yönlendirir.

### 1. Sunucuyu hazırla

```bash
ssh <kullanici>@<sunucu-ip>
docker --version && docker compose version   # yoksa: curl -fsSL https://get.docker.com | sudo sh
```

Firewall'da yalnızca gerekli portlar açık olmalı (`22`, `80`, `443`) — MySQL/
Redis/backend/web `docker-compose.prod.yml`de host'a hiç port açmaz, yalnızca
Docker'ın iç ağında konuşurlar.

### 2. DNS

Domain sağlayıcısında A kaydını sunucu IP'sine yönlendirin. Yayılmayı
`dig +short <domain>` ile kontrol edin ve **DNS gerçekten yayılana kadar**
Caddy adımına geçmeyin — erken denemek Let's Encrypt rate-limit'ine
takılma riski taşır.

### 3. Kodu getir

```bash
cd ~ && git clone <repo-url> congress-beacon && cd congress-beacon
```

### 4. `.env.prod` oluştur

```bash
cp .env.prod.example .env.prod
```

Aşağıdaki değerleri **gerçek/güçlü** değerlerle doldurun:

- `JWT_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` — `openssl rand -hex 32/20`
- `APP_PUBLIC_URL` — `https://<domain>/api`
- `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM`/`MAIL_REPLY_TO` —
  gerçek SMTP sağlayıcı bilgileri (bkz. aşağıdaki "E-posta" bölümü)
- `ANTHROPIC_API_KEY` — bilimsel program PDF/Excel çıkarımı için (opsiyonel)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — push bildirimleri için (opsiyonel, bkz.
  aşağıdaki "Push bildirimleri" bölümü)

`.env.prod` asla git'e commit edilmez (kökteki `.gitignore` zaten hariç
tutar) — `git status` ile `.env.prod`'un görünmediğini doğrulayın.

**Önemli:** backend servisinin `docker-compose.prod.yml`deki `environment:`
bloğu yalnızca `DATABASE_URL`/`JWT_SECRET`/`CORS_ORIGIN`/`REDIS_URL`/
`API_PREFIX`/`PORT`'u taşır — SMTP/Firebase/Anthropic değişkenlerini
container'a geçirmek için bu bloğa ilgili `${VAR}` referanslarının
eklenmesi (veya bir `env_file: .env.prod` direktifinin eklenmesi) gerekir.
Bunlar boşsa uygulama çökmez ama ilgili özellik (e-posta/push/LLM çıkarımı)
sessizce devre dışı kalır — deploy sonrası mutlaka doğrulayın.

### 5. Servisleri ayağa kaldır

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f caddy
# "certificate obtained successfully" satırı beklenir
```

Backend konteyneri başlarken otomatik `npx prisma migrate deploy` çalıştırır
— ayrı bir migration adımı gerekmez.

### 6. Sağlık kontrolü

```bash
curl -sk https://<domain>/api/health          # {"status":"ok"}
curl -sk -o /dev/null -w "%{http_code}\n" https://<domain>/yetkili   # 200
```

### 7. İlk admin kullanıcısını oluştur

```bash
docker compose -f docker-compose.prod.yml exec backend node dist/scripts/create-admin.js \
  "email@adres.com" "guclu-bir-sifre" "Ad Soyad"
```

(`npx ts-node scripts/create-admin.ts` container dışında ÇALIŞTIRILMAZ —
Prisma'nın özel çıktı yolu ts-node'un CJS transpilasyonuyla runtime'da
çözümlenemiyor. Derlenmiş `dist/scripts/*.js` dosyaları container içinde
çalıştırılmalı.)

### 8. Yüklenen görseller için kalıcı depolama

Kongre kapak/mekan/sponsor/konuşmacı görselleri backend konteynerinin
`/app/uploads`una yazılır. `docker-compose.prod.yml`de buna karşılık gelen
kalıcı bir volume (`backend-uploads`) tanımlıdır — konteyner
(`up -d --build backend`) yeniden oluşturulduğunda içerik KORUNUR. Doğrulama:

```bash
docker volume ls | grep backend-uploads
docker compose -f docker-compose.prod.yml exec backend ls -la /app/uploads
```

### 9. Sunucu saat dilimi — `Europe/Istanbul` OLMALI

Oturum/sunum saatlerini kaydeden panel formları, formdan gelen saat-dilimsiz
datetime string'ini **sunucunun yerel saatine göre** yorumlar. Backend
konteyneri UTC çalışırsa (birçok Docker imajının varsayılanı budur) panelde
"14:00" girilen bir saat gerçekte Türkiye saatiyle 17:00'a denk gelir.
`docker-compose.prod.yml`deki backend servisine `TZ=Europe/Istanbul` ortam
değişkeni eklenmeli veya imajın sistem saat dilimi buna göre ayarlanmalı.

### 10. Geriye dönük dolgu betiği (yalnızca ilk deploy sonrası, bir kez)

`User.searchName` alanı migration'dan geriye kalan kullanıcılar için
doldurulmamış olabilir (Türkçe unvan/karakter normalizasyonu SQL'de pratik
değil):

```bash
docker compose -f docker-compose.prod.yml exec backend node dist/scripts/backfill-search-name.js
```

Betik `searchName IS NULL` olan kullanıcıları işler, tekrar çalıştırmak
güvenlidir.

### 11. Push bildirimleri (Firebase + Apple)

`FIREBASE_SERVICE_ACCOUNT_JSON` (Firebase Console → Proje Ayarları → Servis
Hesapları → "Yeni özel anahtar oluştur") tek satıra sıkıştırılıp `.env.prod`'a
yazılır:

```bash
cat service-account.json | tr -d '\n' | pbcopy   # panoya kopyalar (macOS)
```

Bu gerçek bir kimlik bilgisidir — asla `.env.prod.example`'a veya git'e
yazılmaz.

**Apple tarafı backend deploy'undan bağımsızdır**: APNs Authentication Key
(`.p8`, Apple Developer Program ücretli üyelik gerektirir) Firebase
Console'a yüklenmelidir — **hem "Development" hem "Production" APNs auth
key slotuna** aynı `.p8` yüklenmelidir (yalnızca birine yüklemek, diğer
build türünün `Invalid APNs credential` hatası almasına yol açar).

### 12. Mobil taraf için değişiklik gerekmiyor

`mobile/lib/core/config/app_config.dart` production API adresini varsayılan
olarak kullanır — DNS/sunucu ayakta olduğunda mobil uygulama otomatik
konuşmaya başlar, yeni bir build gerekmez.

## Bakım / günlük komutlar

```bash
# Loglar
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web

# Yeni kod geldiğinde yeniden deploy
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Servisleri durdurma (VERİ SİLİNMEZ, yalnızca konteynerler durur)
docker compose -f docker-compose.prod.yml down

# MySQL yedeği
docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" congress_beacon > yedek-$(date +%F).sql
```

## E-posta sağlayıcı notu (Brevo)

SMTP sağlayıcısı olarak Brevo kullanılıyor — kredi kartı gerektirmeden
başlanabilir, DKIM/SPF otomatik algılanıp tek tıkla kuruluyor, ücretsiz
plan günde 300 e-postaya izin veriyor. DNS doğrulaması **alt alan adında**
(ör. `auth.example.com`) yapılmalı, kök alan adında DEĞİL — kök alan adının
kendi (ilgisiz) SPF/DMARC kaydı olabilir. Hacim büyürse (kongre başına on
binlerce e-posta) Amazon SES daha ucuz hale gelir — kod tarafı
(`SmtpMailSender`, nodemailer/SMTP) sağlayıcıdan bağımsızdır, geçiş yalnızca
`.env.prod`deki `SMTP_*` değerlerinin değişmesini gerektirir.

## Diğer dokümanlar

- Mimari genel bakış: `docs/MIMARI.md`
- Salon tespit algoritması: `docs/ALGORITMA.md`
- Kararlar ve gerekçeleri: `docs/KARARLAR.md`
- Ürün tanıtımı: `docs/URUN.md`
