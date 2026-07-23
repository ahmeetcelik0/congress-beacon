# Salon Tespit Algoritması v3 — Uygulama Talimatı

> Bu doküman, kongre beacon sisteminin salon-tespit algoritmasını `v2`'den `v3`'e yükseltmek için bir Claude Code oturumuna verilecek uygulama talimatıdır. Kapsam, ekip tarafından bilinçli olarak daraltılmıştır (bkz. §3 "Kapsam dışı"); önerilen her ek, bu projenin ölçeğine (küçük ekip, geçici kongre etkinlikleri) göre elenmiştir. İnsan tarafına yönelik gerekçe için `docs/algoritma-v3-degisiklik-ozeti.md` dosyasına bakın.

## 1. Bağlam ve amaç

Mevcut algoritma (`ALGORITHM_VERSION = 'v2'`, `backend/src/attendance/attendance-processing.service.ts`) her ölçümü (snapshot) bağımsız değerlendiriyor: görülen beacon'ları salonlarına göre gruplayıp ortalama alıyor, salonun sabit eşiğini geçen en güçlü salonu "aday" seçiyor, 2 ölçüm üst üste aynı aday çıkarsa girişi/çıkışı resmileştiriyor.

Bilinen sınırlar:
- Ham RSSI hiç zaman içinde yumuşatılmıyor (yalnızca `rssi === 0` sentinel'i filtreleniyor).
- Kazanan salon yalnızca **kendi eşiğine** göre değerlendiriliyor, ikinci sıradaki salona göre değil.
- Güven etiketi 3 kategori, gerçek yüzde değil.
- Kararın nasıl üretildiğine dair hiçbir iz (trace) tutulmuyor.

**Hedef (v3):** Ham sinyali zaman içinde temizleyip yumuşatan, salonlar arası göreli bir güven yüzdesi üreten, her kararın gerekçesini kaydeden ve kullanıcının anlık durumunu (içeride/belirsiz/sinyal yok) ayrıştıran bir sürüme yükseltmek — bunu yaparken katılımcı/salon analitiğini (kalış süresi, medyan, sayım, güven skoru) panelde izlenebilir kılmak.

## 2. Kapsam

**Değişecek:**
- `backend/prisma/schema.prisma` — `Congress` modeline yeni tuning alanları; `AttendanceEvent`'e `decisionTrace` alanı; `UserPresenceState`'e `currentStatus` alanı (bkz. §4).
- `backend/src/attendance/attendance-processing.service.ts` — karar algoritmasının kendisi.
- Yeni bir yardımcı modül: sinyal filtreleme + yumuşatma (Hampel + EMA), Redis destekli, ayrı ve test edilebilir.
- `backend/src/attendance/attendance-query.service.ts` — yeni analitik sorguları.
- `backend/src/attendance/attendance.controller.ts` — yeni analitik uç noktaları.
- `backend/src/reports/reports.service.ts` — `getBeaconHealth()`'e 2 yeni metrik.
- `backend/src/tracking-health/*` — `currentStatus` (İçeride/Belirsiz/Sinyal Yok) entegrasyonu.
- `web/src/app/attendance/*` — güven yüzdesi gösterimi, "Ham Gözlem Akışı" panelinde karar gerekçesi, yeni "Katılımcı Profili" görünümü (opsiyonel).
- `web/src/app/tracking-health/*` — durum ayrımı ve outlier oranı gösterimi.
- `web/src/lib/api.ts` — yeni endpoint'ler için client fonksiyonları.

**Değişmeyecek:**
- Mobil uygulamanın beacon tarama/gönderim mekanizması — hâlâ yalnızca ham RSSI/uuid/major/minor/txPower gönderiyor. **Mobil tarafa hiçbir yeni alan (pil, foreground/background durumu, izin durumu, Bluetooth durumu) eklenmeyecek** — bu, `docs/decisions.md`'de zaten belgelenmiş bilinçli bir mimari karardır ("mobil kaynak/confidence bilgisi göndermiyor, yalnizca ham RSSI"); değiştirilmesi ayrı, açık bir karar gerektirir.
- `POST /observations/batch` request/response sözleşmesi.
- `ObservationBatch` / `BeaconObservation` tablolarının ham veri saklama mantığı — hiçbir yeni sütun eklenmiyor, hâlâ hiçbir şey ortalanmadan saklanacak.
- `algorithmVersion` alanının konumu — zaten doğru yerde (`AttendanceEvent`, `HallVisit`); **ham `BeaconObservation`'a taşınmayacak** (bkz. §3).
- Session/notifications/devices modülleri.
- Mevcut `stale-visit-sweep` (5 dakika sessizlikte ziyaret kapatma) mantığı.

## 3. Kapsam dışı bırakılanlar (bilinçli karar — bunları EKLEMEYİN)

Bu değişikliğin tasarım sürecinde önerilmiş ama bu proje için gereksiz/erken bulunmuş maddeler. Bir sonraki oturum bunları "unutulmuş" sanıp eklemeye kalkışmamalı:

1. **Replay Engine** (geçmiş veriyi yeni algoritma sürümüyle toplu yeniden işleyen ayrı bir alt-sistem) — kurulmayacak. Bu yetenek zaten mimaride var: ham veri hiç değiştirilmeden saklanıyor, karar `algorithmVersion` ile sürümleniyor (`docs/decisions.md`, "Ham veri / backend-karar mimarisi" bölümü, bu ayrımın amacının "geçmiş verilerin yeniden işlenebilmesini sağlamak" olduğu açıkça yazıyor). Gerekirse ileride küçük, tek seferlik bir script olarak eklenir.
2. **Ayrı bir `AlgorithmConfig` tablosu/modeli** — kurulmayacak. Yeni parametreler doğrudan `Congress` modeline eklenir (bkz. §4.3) — proje zaten bu deseni (`observationIntervalSeconds`) kullanıyor.
3. **`algorithmVersion`'ın `BeaconObservation`'a taşınması** — yapılmayacak. Ham veri "bir algoritmaya ait" değildir; doğru yer zaten karar kayıtlarıdır (`AttendanceEvent.algorithmVersion`, `HallVisit.algorithmVersion`).
4. **Ayrı bir "Telemetry/Observability" sistemi** — kurulmayacak. Katman başına loglama için mevcut NestJS `Logger` yeterli; yapısal/queryable ihtiyaç `decisionTrace` alanıyla (§4.2) karşılanıyor.
5. **Ham `BeaconObservation`'a yeni cihaz/ortam alanları** (pil, foreground/background, izin durumu, Bluetooth durumu, tarama süresi) — eklenmeyecek. Telefon modeli/OS zaten `Device` tablosunda var (`deviceId` join'i ile erişilebilir); kalanı §2'de belirtildiği gibi mevcut bir mimari kararla çelişiyor.
6. **Ayrıntılı bir "Analitik Dashboard" tasarımı** — bu talimatın kapsamında değil. §7'deki panel değişiklikleri MVP seviyesinde tutulmalı; kapsamlı bir dashboard tasarımı, bu değişiklik uygulanıp gerçek veri şekli netleştikten sonra ayrı bir doküman olarak ele alınmalı.

## 4. Veri modeli değişiklikleri

### 4.1 Beacon-sinyal çalışma durumu — Redis (YENİ TABLO DEĞİL)

Kullanıcı×beacon başına, kararı hesaplamak için gereken küçük ve geçici durum **Redis'te** tutulur — kalıcı bir Prisma tablosunda DEĞİL. Gerekçe: bu veri rapor/analitik verisi değil, yalnızca canlı karar hesaplaması için çalışma belleğidir; proje zaten Redis'i (BullMQ için, `REDIS_URL` ile) kullanıyor, yeni bir servis/bağımlılık eklenmiyor.

Önerilen anahtar/değer şekli:

```
Key:    beacon-signal:{userId}:{beaconId}
Value (JSON): {
  "emaValue": number,
  "recentRssi": number[],   // son ≤5 kabul edilmiş ham RSSI (Hampel penceresi)
  "updatedAt": string       // ISO timestamp
}
TTL: 6-12 saat (kongre günü sonunda otomatik temizlenir; her güncellemede yenilenir)
```

- Mevcut BullMQ bağlantısının kullandığı aynı `REDIS_URL`/ioredis client'ı yeniden kullanılmalı — ayrı bir Redis kütüphanesi eklenmemeli.
- Bu anahtarın kaybolması (Redis restart, TTL dolması) **kritik bir veri kaybı değildir** — sistem birkaç ölçüm içinde pencereyi yeniden doldurur; bu bilinçli bir tasarım tercihidir (dürüstlük: Redis'in kalıcılığı yoktur, ve bunun burada sorun olmadığı açıkça kabul edilmelidir).

### 4.2 Yeni/güncellenen Prisma alanları

```prisma
model AttendanceEvent {
  // ...mevcut alanlar...
  decisionTrace Json? // YENİ: karar gerekçesi (bkz. aşağıda)
}

model UserPresenceState {
  // ...mevcut alanlar...
  currentStatus PresenceStatus @default(NO_SIGNAL) // YENİ
}

enum PresenceStatus {
  IN_HALL     // net bir salonda, doğrulanmış
  AMBIGUOUS   // iki (veya daha fazla) salon arasında, yüzdeler birbirine çok yakın
  NO_SIGNAL   // hiçbir beacon'dan geçerli veri gelmiyor
}
```

- `AttendanceEvent.confidenceScore` (`Float?`, zaten var) — artık **0-100 arası yüzde** taşır (şu an ham dB marjı taşıyor). **Geçmiş veri için migration/backfill YAPILMAYACAK** — `algorithmVersion` ayrımı (`'v2'` vs `'v3'`) sayesinde eski/yeni anlam karışmaz.
- `HallVisit.confidenceLevel` (`String?`, zaten var) — yeni yüzdeden türetilen bir etiket olarak korunur (ör. ≥80 "yuksek", ≥55 "orta", altı "dusuk") — mevcut UI'larla geriye dönük uyumluluk için.
- `decisionTrace` önerilen şekil: `{ "candidates": [{"hallId": "...", "percentage": 95.2, "beaconReadings": [{"beaconId":"...","emaValue":-64.1,"rawAccepted":true}]}], "runnerUpGapPct": 21.4, "rejectedOutliers": 1 }` — kesin şema zorunlu değil, amaç "bu karar neden verildi" sorusuna cevap verebilmek.
- `ALGORITHM_VERSION` sabiti `'v2'` → `'v3'`.

### 4.3 Congress modeline yeni tuning alanları (AYRI TABLO DEĞİL)

```prisma
model Congress {
  // ...mevcut alanlar (observationIntervalSeconds dahil)...
  emaAlpha                    Float @default(0.35)
  hampelK                     Float @default(3)
  hampelWindowSize            Int   @default(5)
  confidenceTemperature       Float @default(8)
  entryProbabilityThreshold   Float @default(60)
  exitProbabilityThreshold    Float @default(40)
  ambiguityMarginPct          Float @default(5)
}
```

Bu alanlar, mevcut `observationIntervalSeconds` ile aynı desende panelden düzenlenebilir olmalı.

### 4.4 Migration

Standart bir Prisma migration yeterli (`npx prisma migrate dev --name attendance-v3`) — mevcut tablolarda veri dönüşümü gerekmiyor, yalnızca yeni sütunlar/enum ekleniyor.

## 5. Algoritma spesifikasyonu

### Katman 1 — Veri kalitesi kapısı (beacon başına, her okuma)

1. `rssi >= 0` ise reddet (mevcut `isValidRssi` kuralı, korunur).
2. Redis'teki `recentRssi` penceresinden medyan ve MAD hesaplanır. Yeni okuma `|okuma - medyan| > hampelK * MAD` ise reddedilir (pencere <5 ise doğrudan kabul edilir).
3. Kabul edilen okuma Redis'teki pencereye eklenir (FIFO, son `hampelWindowSize` tutulur).
4. Reddedilen okuma bu snapshot için "görülmedi" sayılır; Redis state değişmez.

### Katman 2 — Zamansal yumuşatma (beacon başına, Redis'teki `emaValue` güncellenir)

```
EMA(t) = α · RSSI(t) + (1 − α) · EMA(t−1)     [α = Congress.emaAlpha]
```
İlk okumada `EMA(0) = RSSI(0)`. **Adaptif (KAMA-tarzı) α bu sürümde YOK** — sabit α yeterli, ileride ayrı bir iyileştirme.

### Katman 3 — Salon içi uzamsal birleştirme

Bir salona aktif atanmış (`HallBeacon.isActive`) ve o an geçerli bir Redis-EMA'sı olan beacon'ların ortalaması. **Salon eşiği:** `Hall.rssiThreshold` esas alınır; `HallBeacon.rssiThreshold` override'ları yalnızca Katman 1'in outlier-hassasiyeti için kullanılabilir, salon-seviyesi karar eşiği için kullanılmaz.

### Katman 4 — Salonlar arası karşılaştırma + güven yüzdesi

```
P(salon h) = exp(ortalama(h) / T) / Σ_j exp(ortalama(j) / T)     [T = Congress.confidenceTemperature]
```
En az bir aktif EMA'sı olan HER salon hesaba katılır. Nihai aday: en yüksek yüzdeye sahip VE `Hall.rssiThreshold`'unu geçen salon.

### Katman 5 — Zaman içi doğrulama + durum ataması

- Mevcut `ENTRY_STREAK_THRESHOLD`/`EXIT_STREAK_THRESHOLD` (2) korunur, artık yüzde üzerinden çalışır:
  - **Giriş:** aday yüzdesi ≥ `entryProbabilityThreshold`, 2 ölçüm üst üste → `PresenceStatus.IN_HALL`, `HallVisit`/`AttendanceEvent` açılır, `decisionTrace` yazılır.
  - **Çıkış:** açık ziyaretin yüzdesi < `exitProbabilityThreshold`, 2 ölçüm üst üste → ziyaret kapanır.
- İki salonun farkı `< ambiguityMarginPct` ise → `PresenceStatus.AMBIGUOUS`, ne giriş ne çıkış tetiklenir.
- Hiçbir beacon'dan geçerli okuma gelmiyorsa (mevcut tracking-health "veri yok" eşiğiyle tutarlı, ör. son 2 dakikadır hiç veri yok) → `PresenceStatus.NO_SIGNAL`.
- Tam eşitlikte: açık olan salon önceliklenir; hiç açık ziyaret yoksa `hallId`'ye göre deterministik ikincil sıralama.

## 6. Yeni/güncellenen API uçları

| Uç nokta | Açıklama |
|---|---|
| `GET /attendance/users/:userId/summary` (yeni) | Toplam kalış süresi, ziyaret edilen salon sayısı, giriş sayısı, ortalama güven skoru, ilk/son görülme zamanı |
| `GET /attendance/summary` (güncelle) | Salon bazlı bloğa `averageConfidenceScore` eklenir |
| `GET /admin/tracking-health` (güncelle) | `currentStatus` (İçeride/Belirsiz/Sinyal Yok) ve `outlierRejectionRate` eklenir |
| `GET /reports/beacon-health` (güncelle) | `averageRssi` ve `usersSeenCount` eklenir (mevcut `observationCount`/`lastSeenAt`'in yanına) |
| `GET /attendance/hall-visits/:id/trace` (yeni, opsiyonel) | Bir ziyaretin `decisionTrace` verisini döner — panel debug görünümü için |

Yeni uç noktalar mevcut `AdminJwtGuard` ile korunmalı.

## 7. Web panel değişiklikleri

1. Güven skoru: yüzde olarak gösterilir (ör. rozet "%92"), mevcut "yuksek/orta/dusuk" etiketi korunur ama artık bu yüzdeden türetilir.
2. "Ham Gözlem Akışı" debug panelinin yanına, bir ziyaretin `decisionTrace`'ini gösteren küçük bir ek görünüm (mevcut debug-panel desenini genişletir, yeni bir sayfa değil).
3. Takip Sağlığı sayfasına `currentStatus` (İçeride/Belirsiz/Sinyal Yok) sütunu ve outlier oranı.
4. Beacon Sağlığı raporuna ortalama RSSI ve görülen kullanıcı sayısı sütunları.
5. "Kalış Süresi" kartına salon bazlı ortalama güven skoru.
6. (Opsiyonel, ayrı bir küçük iş olarak) Katılımcı arama + `GET /attendance/users/:userId/summary` ile özet kart.
7. `web/src/lib/api.ts` içine yeni uç noktalar için client fonksiyonları.

## 8. Önerilen uygulama sırası

1. **Faz A — Şema:** Congress'e yeni alanlar, `AttendanceEvent.decisionTrace`, `UserPresenceState.currentStatus` + migration.
2. **Faz B — Filtreleme/yumuşatma modülü:** Hampel + EMA, Redis okuma/yazma, bağımsız test edilebilir saf fonksiyonlar.
3. **Faz C — Karar mantığı:** `attendance-processing.service.ts` güncellemesi (softmax, asimetrik eşik, decisionTrace, currentStatus). `ALGORITHM_VERSION='v3'`.
4. **Faz D — Analitik uç noktaları:** §6.
5. **Faz E — Panel UI:** §7 (MVP seviyesinde; ayrıntılı dashboard tasarımı kapsam dışı, bkz. §3).
6. **Faz F — Parametrelerin panelden ayarlanabilir hale getirilmesi:** §4.3.
7. **Faz G — Saha testi:** gerçek beacon'larla parametre ince ayarı (kod değişikliği değil).

## 9. Test beklentileri

Mevcut kod tabanında attendance mantığı için birim testi yok — bu fırsat kullanılmalı:

- Hampel filtresi: bilinen pencere + outlier → doğru reddetme/kabul.
- EMA: bilinen RSSI dizisi → beklenen yumuşatılmış değer.
- Softmax: bilinen ortalamalar → yüzdelerin toplamı %100, doğru sıralama.
- Asimetrik eşik + streak + `AMBIGUOUS`/`NO_SIGNAL` geçişleri: sınır senaryoları.
- `resolveCandidateHall`/`applySnapshot`'ın dışa dönük imzası değişmemeli — yalnızca iç hesaplama değişiyor.
- Redis bağlantısı testte mock'lanabilir (gerçek Redis'e bağımlı olmayan birim testleri).

## 10. Kabul kriterleri (Definition of Done)

- [ ] Beacon-sinyal durumu Redis'te tutuluyor, hiçbir yeni kalıcı Prisma tablosu YOK.
- [ ] Hampel filtresi + EMA, ayrı ve test edilmiş bir modülde.
- [ ] `attendance-processing.service.ts` yeni katmanları kullanıyor, `ALGORITHM_VERSION='v3'`.
- [ ] `AttendanceEvent.confidenceScore` 0-100 yüzde taşıyor; eski `'v2'` kayıtlar dokunulmadan duruyor.
- [ ] `AttendanceEvent.decisionTrace` her yeni giriş/çıkışta doluyor.
- [ ] `UserPresenceState.currentStatus` (İçeride/Belirsiz/Sinyal Yok) doğru güncelleniyor.
- [ ] Salon eşiği her zaman salon-seviyesinde tek ve net.
- [ ] Yüzdeler yakınsa sistem `AMBIGUOUS`, rastgele seçim yapmıyor.
- [ ] Yeni parametreler `Congress` modelinde, panelden ayarlanabilir; ayrı `AlgorithmConfig` tablosu YOK.
- [ ] `algorithmVersion` hâlâ yalnızca `AttendanceEvent`/`HallVisit`'te; `BeaconObservation`'a eklenmedi.
- [ ] Mobil uygulamada ve `POST /observations/batch` sözleşmesinde hiçbir değişiklik yok.
- [ ] Mevcut `/attendance/summary`, `/attendance/occupancy-series`, `/reports/*` uçları kırılmadan çalışıyor.
- [ ] Yeni algoritma katmanları için birim testleri var.
- [ ] Hiçbir "Replay Engine", ayrı "Telemetry sistemi" veya kapsamlı "Dashboard" alt yapısı eklenmedi (kapsam dışı, §3).

## 11. Referans

Tasarım gerekçesi, literatür karşılaştırması ve elenen alternatiflerin değerlendirmesi için `docs/algoritma-v3-degisiklik-ozeti.md` dosyasına ve projenin `docs/decisions.md` dosyasındaki "Ham veri / backend-karar mimarisi" bölümüne bakın.
