# Deploy Rehberi — deploy@45.133.36.26

Bu dosya repo'ya commit edilmedi, yalnızca elden takip için. Adımları sen (Berke) sunucuda
çalıştıracaksın; ben sunucuya bağlanmıyorum.

---

## 0) Önce oku — branch durumu (önemli karar)

`main` branch'i şu an **`develop`'ın 19 commit gerisinde** ve şunları İÇERMİYOR:

- Production Docker + Caddy altyapısının tamamı (`docker-compose.prod.yml`, `Caddyfile` —
  bunların eklendiği commit yalnızca `develop`'ta)
- Admin auth, audit log, tracking-health, reports, Session/bildirim backend'i
- Panelin son tasarımı (Signal Console) ve admin girişi
- İki mobil arka plan ranging düzeltmesi

Yani README'deki "main = test edilmiş kararlı sürüm, deploy oradan yapılır" kuralını **şu an
harfiyen uygularsak, deploy edilecek bir prod altyapısı bile yok.** Aşağıdaki adımlar bu yüzden
**`develop`** branch'ini deploy ediyor (test raporundaki her şey bu branch üzerinde doğrulandı).

Kendi kuralınız gereği `main`'e doğrudan push yapmıyorsunuz, o yüzden ben `develop`'ı `main`'e
merge etmedim/push etmedim — bunu (istersen) bir PR ile sen/Ahmet karar verip yapmalısınız. İstersen
deploy'dan sonra bunu birlikte konuşalım.

---

## 1) Sunucuyu keşfet (değiştirmeden önce)

```bash
ssh deploy@45.133.36.26
```

Bağlandıktan sonra, hiçbir şeyi durdurmadan/silmeden önce mevcut durumu gör:

```bash
# Isletim sistemi
cat /etc/os-release

# Calisan konteynerler (Docker kuruluysa)
docker ps -a 2>&1

# 80/443/22/3306/6379 portlarinda ne dinliyor
sudo ss -tlnp | grep -E ':(22|80|443|3306|6379)\b'

# Sistemde calisan servisler (nginx/apache gibi web sunuculari var mi?)
systemctl list-units --type=service --state=running 2>&1 | grep -iE 'nginx|apache|caddy|docker'

# Disk ve RAM
df -h /
free -h
```

Buradan çıkan sonucu bana yapıştır; özellikle 80/443'te başka bir şey dinliyorsa (eski bir
nginx/apache) onu durdurup devre dışı bırakmamız gerekecek — Caddy o portları kullanacak.

---

## 2) DNS (Caddy'nin otomatik HTTPS alması için ŞART)

Domain sağlayıcınızda `beacon.photofocustr.com` için **A kaydını** `45.133.36.26`'ya güncelleyin.
DNS yayılması birkaç dakika-birkaç saat sürebilir. Kontrol:

```bash
dig +short beacon.photofocustr.com
# 45.133.36.26 donene kadar Caddy adimina gecmeyin - erken denerse
# Let's Encrypt rate-limit'ine takilma riski var.
```

---

## 3) Docker kurulumu (yoksa)

```bash
docker --version && docker compose version
```

Yoksa (Debian/Ubuntu için resmi script):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Bu satirdan sonra cikis yapip tekrar ssh ile baglanin ki grup degisikligi gecerli olsun.
```

Firewall (ufw kullanılıyorsa) — yalnızca gerekli portlar açık olsun:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

(Not: `docker-compose.prod.yml` içinde yalnızca `caddy` servisi host'a port açıyor — 80/443.
mysql/redis/backend/web dışarıya hiç açılmıyor, yalnızca Docker'ın iç ağında konuşuyorlar. Bu
zaten güvenli bir varsayılan.)

---

## 4) Kodu sunucuya getir

```bash
cd ~
git clone -b develop https://github.com/ahmeetcelik0/congress-beacon.git
cd congress-beacon
```

(Zaten klonluysa: `cd congress-beacon && git fetch && git checkout develop && git pull`.)

---

## 5) `.env.prod` oluştur

```bash
cp .env.prod.example .env.prod
```

`.env.prod` içindeki şu değerleri **gerçek/güçlü** değerlerle değiştir (nano/vim ile aç):

```bash
openssl rand -hex 32   # JWT_SECRET icin
openssl rand -hex 20   # MYSQL_ROOT_PASSWORD icin
openssl rand -hex 20   # MYSQL_PASSWORD icin
```

`.env.prod` asla git'e commit edilmiyor (kökteki `.gitignore` zaten hariç tutuyor) — kontrol et:

```bash
git status   # .env.prod "untracked" bile gorunmemeli/gorunse de commit edilmemeli
```

---

## 6) Servisleri ayağa kaldır

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml ps
```

Backend konteyneri **başlarken otomatik olarak** `npx prisma migrate deploy` çalıştırıp sonra
uygulamayı başlatıyor (`backend/Dockerfile` CMD'si) — ayrı bir migration adımına gerek yok.

Logları izle (özellikle ilk açılışta Caddy'nin sertifika alıp almadığını görmek için):

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
# "certificate obtained successfully" gibi bir satir gormelisin.
# Basarisiz olursa (DNS henuz yayilmadi/80 portu baska bir seyle meskul) burada gorunur.
```

`Ctrl+C` ile log takibinden çık (servisler durmaz).

---

## 7) Sağlık kontrolü

```bash
curl -sk https://beacon.photofocustr.com/api/health
# {"status":"ok"} beklenir

curl -sk -o /dev/null -w "%{http_code}\n" https://beacon.photofocustr.com/yetkili
# 200 beklenir (admin girisine yonlendirmeden once login sayfasi)
```

---

## 8) İlk admin kullanıcısını oluştur

**Not:** `npx ts-node scripts/create-admin.ts ...` çalıştırmaya ÇALIŞMAYIN — bu, test raporunda
bulunan bir hata yüzünden (`Cannot find module './internal/class.js'`) başarısız olur. Derlenmiş
halini konteyner içinde çalıştırın:

```bash
docker compose -f docker-compose.prod.yml exec backend node dist/scripts/create-admin.js \
  "gercek-email@adres.com" "guclu-bir-sifre" "Ad Soyad"
```

Başarılı çıktı: `Admin kullanici hazir: ... (id: ...)`.

`https://beacon.photofocustr.com/yetkili/admin/login` adresinden bu bilgilerle giriş yapıp
kongre/salon/beacon tanımlarını panelden oluşturabilirsiniz (bkz. `TEST-RAPORU.md`'deki akış —
aynı adımlar, yalnızca artık gerçek domain üzerinden).

---

## 9) Mobil taraf için değişiklik gerekmiyor

`mobile/lib/core/config/app_config.dart` zaten `https://beacon.photofocustr.com/api`'yi varsayılan
API adresi olarak kullanıyor — DNS güncellenip sunucu ayakta olduğunda mobil uygulama otomatik
olarak yeni sunucuya konuşacak, yeni bir build/TestFlight yüklemesi gerekmez.

---

## 9.5) Faz 3 — yüklenen görseller için kalıcı depolama (ÖNEMLİ, mevcut kurulumda elle uygulanmalı)

Faz 3'te panelden kongre kapak görseli, mekan fotoğrafı, sponsor logosu ve konuşmacı fotoğrafı
yüklenebiliyor (`backend/src/uploads`). Bu dosyalar backend konteynerinin içinde
`/app/uploads/<congressId>/...` yoluna yazılıyor. `docker-compose.prod.yml`'a bunun için kalıcı
bir Docker volume (`backend-uploads:/app/uploads`) eklendi — **ama bu, sunucuda zaten çalışan
eski bir konteynerde otomatik devreye girmez**, `docker compose up -d --build backend` ile
konteyner yeniden oluşturulduğunda Docker bu volume'u yeni oluşturur (boş başlar, önceki hiçbir
şey kaybolmaz çünkü bu volume daha önce hiç yoktu). Kontrol:

```bash
docker compose -f docker-compose.prod.yml up -d --build backend
docker volume ls | grep backend-uploads
# congress-beacon_backend-uploads gibi bir satir gormelisiniz

# Bir gorsel yukleyip (panelden) sonra konteyneri yeniden olusturarak
# (up -d --build backend) dosyanin hala orada oldugunu dogrulayin:
docker compose -f docker-compose.prod.yml exec backend ls -la /app/uploads
```

Caddyfile'da **ayrı bir değişiklik gerekmiyor** — yüklenen görseller `/api/uploads/...` altında
servis ediliyor (backend'in `API_PREFIX=api` ayarına göre), bu yüzden zaten var olan
`handle /api/* { reverse_proxy backend:3001 }` kuralının kapsamına giriyor.

---

## 9.6) Faz 4a — `User.searchName` geriye dönük doldurma (migration sonrası ELLE çalıştırılmalı)

Faz 4a'nın `20260810000000_scientific_program_model` migration'ı `User` tablosuna `searchName`
kolonunu ekliyor ama bu migration Faz 4a ÖNCESİ oluşmuş kullanıcılar için bu alanı
**doldurmuyor** (SQL ile Türkçe unvan/karakter normalizasyonu pratik değil — bkz.
`docs/decisions.md`). Migration deploy edildikten sonra bir kez şu betik çalıştırılmalı:

```bash
# Sunucuda, backend konteyneri içinde:
docker compose -f docker-compose.prod.yml exec backend sh -c \
  "node dist/scripts/backfill-search-name.js"
```

Betik yalnızca `searchName IS NULL` olan kullanıcıları işler, bu yüzden **tekrar çalıştırmak
güvenlidir** (yeni kullanıcılar zaten oluşturulurken bu alanı dolduruyor, bkz.
`registrations.service.ts`/`registration-import.service.ts`/`auth.service.ts`). Betik
`DATABASE_URL` ortam değişkenini backend konteynerinin kendi `.env`'inden okur, ayrıca bir
parametre gerekmez. Konsolda `"N kullanici icin searchName hesaplanacak."` ve ardından
`"Tamamlandi: N kullanici guncellendi."` çıktısı beklenir.

---

## 9.7) Faz 4b — PDF/Excel'den bilimsel program çıkarımı (Claude API anahtarı)

Bu faz `.env.prod`'a üç yeni değişken ekliyor:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # gerçek Anthropic API anahtarı
ANTHROPIC_MODEL=claude-opus-4-8
ANTHROPIC_MAX_OUTPUT_TOKENS=128000
```

**`ANTHROPIC_API_KEY` boş bırakılırsa uygulama ÇÖKMEZ** — yalnızca
`/admin/program-imports/estimate` ve `POST /admin/program-imports` uç
noktaları `503` döner, panelde "Program çıkarımı için API anahtarı
yapılandırılmamış" mesajı gösterilir; kongre/salon/beacon/katılımcı/
bilimsel program (Faz 4a elle yönetim) gibi geri kalan hiçbir özellik
etkilenmez (bkz. `docs/decisions.md`, `MailSender` ile aynı zarif düşme
deseni).

**Model seçimi.** `ANTHROPIC_MODEL` üretimde de env'den okunur, koda
gömülü değildir — model karşılaştırması sonucuna göre (bkz. Faz 4b canlı
test raporu) değiştirilebilir; kod değişikliği gerekmez, yalnızca
`.env.prod` güncellenip `docker compose -f docker-compose.prod.yml up -d`
ile yeniden başlatılır.

**Kullanıcının API kredisi sınırlıdır** — production'da da panel her
zaman önce `estimate` (ücretsiz token sayımı) ile tahmini gösterir ve
açık onay almadan gerçek çıkarımı başlatmaz; yine de sunucu loglarını
(`docker compose -f docker-compose.prod.yml logs -f backend`) ilk
üretim kullanımlarında takip etmekte fayda var.

**Sunucu saat dilimi `Europe/Istanbul` olmalı.** Faz 4a'dan beri oturum/
sunum saatlerini kaydeden Server Action'lar formdan gelen naif
(saat dilimsiz) datetime-local string'ini `new Date(value).toISOString()`
ile SUNUCUNUN yerel saatine göre yorumluyor — backend konteyneri UTC
çalışırsa (birçok Docker imajının varsayılanı budur) yetkili panelde
"14:00" girilen bir saat aslında UTC 14:00 olarak kaydedilir, yani
gerçekte Türkiye saatiyle 17:00'a denk gelir. `docker-compose.prod.yml`
backend servisine `TZ=Europe/Istanbul` ortam değişkeni eklenmeli veya
imajın sistem saat dilimi buna göre ayarlanmalı (bkz. `docs/decisions.md`
Faz 4b — canlı testte bulunan sorunlar).

---

## 10) Bakım / günlük komutlar

```bash
# Loglar
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web

# Yeni kod geldiginde yeniden deploy
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Servisleri durdurma (VERI SILINMEZ, sadece konteynerler durur)
docker compose -f docker-compose.prod.yml down

# MySQL yedegi (mysql-data volume'unu yedeklemek icin ornek)
docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" congress_beacon > yedek-$(date +%F).sql
```

---

## Önerim / açık soru

`develop`'ı `main`'e alıp almayacağımızı (PR ile) birlikte karara bağlamak isterim — deploy'u
engellemiyor (yukarıdaki adımlar `develop`'tan çalışıyor), ama kendi git kurallarınızla tutarlı
olması için bir noktada main'i güncellemek isteyebilirsiniz.
