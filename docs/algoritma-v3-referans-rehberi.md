# Salon Tespit Algoritması v3 — Referans Rehberi

> Bu doküman, `docs/algoritma-v3-uygulama-talimati.md`'de tasarlanan ve saha testleriyle (`docs/saha-testi-protokolu-ev.md`) olgunlaştırılan v3 algoritmasının **şu an kodda gerçekten çalıştığı hâliyle** tam referansıdır. Amaç: "nasıl çalışıyor" sorusuna kod okumadan cevap verebilmek, ve panelde gördüğünüz her rakamın nereden geldiğini bilmek. Tasarım gerekçeleri için `docs/algoritma-v3-degisiklik-ozeti.md`'ye, uygulama sırasında bulunup düzeltilen gerçek hatalar için `docs/decisions.md`'nin "Salon Tespit Algoritması v3" bölümüne bakın.

---

## 1. Genel bakış

Sistem, bir katılımcının hangi salonda olduğuna **tek bir ölçüme değil**, zaman içinde biriken kanıta bakarak karar veriyor. Telefon her ~1 saniyede bir "o an duyduğu beacon'lar" anlık görüntüsünü (snapshot) gönderiyor; backend bu snapshot'ları sırayla işleyip 5 katmandan geçiriyor ve sonunda "şu an içeride / belirsiz / sinyal yok" kararına varıyor.

**Mimarinin temel ilkesi** (`docs/decisions.md`): mobil uygulama salon kararı **vermez**, yalnızca ham `uuid/major/minor/rssi` gönderir. Tüm karar mantığı backend'de, `AttendanceProcessingService` içinde toplanır — versiyonlanır (`algorithmVersion`), test edilebilir ve gerekirse geçmiş veri üzerinde yeniden çalıştırılabilir.

```
Telefon (ham RSSI) → POST /observations/batch → ObservationIngestionService
                                                        │
                                                        ▼
                                          AttendanceProcessingService
                                     (Katman 1-5, her snapshot için sırayla)
                                                        │
                                                        ▼
                              HallVisit / AttendanceEvent / UserPresenceState
                                                        │
                                                        ▼
                                              Web panel (Canlı Takip, Raporlar...)
```

---

## 2. Algoritmanın 5 katmanı

Kod: `backend/src/attendance/attendance-processing.service.ts` (orkestrasyon), `backend/src/attendance/signal/signal-math.ts` (saf matematik), `backend/src/attendance/presence-transition.ts` (Katman 5, saf karar mantığı).

### Katman 1 — Veri kalitesi kapısı

Her beacon okuması için, **beacon başına**:

1. **Sentinel kapısı:** `rssi ≥ 0` gelirse bu okuma anında elenir. Gerçek RSSI her zaman negatiftir; `0` (veya pozitif), CoreLocation/flutter_beacon'ın "bu taramada güvenilir bir değer alınamadı" sinyalidir. Bu okuma pencereye de girmez (medyanı bozmasın diye).
2. **Hampel outlier tespiti:** Beacon'ın son `hampelWindowSize` (varsayılan 5) okumasından medyan ve MAD (Median Absolute Deviation — medyandan sapmaların medyanı, standart sapmaya benzer ama tek bir uç değerden etkilenmez) hesaplanır:
   ```
   outlier ⟺ |yeni_okuma − medyan| > hampelK × MAD
   ```
   İki istisna: pencere henüz dolmadıysa (< 5 okuma) veya `MAD = 0` ise (telefon sabit dururken RSSI hep aynı değere kuantalanabilir), filtre devre dışı kalır — aksi hâlde ilk durumda güvenilmez istatistikle karar verilir, ikincisinde filtre kilitlenip bir daha hiç okuma kabul etmez (bu, saha testinde gerçekten yaşanıp düzeltilen bir hataydı, bkz. §9).
3. **Pencere her zaman kayar** — outlier olsun olmasın (sentinel hariç). Bu da saha testinde bulunan bir hatanın düzeltmesi: pencereye yalnızca kabul edilenler girseydi, gerçek bir hareket sırasında tüm yeni okumalar reddedilip pencere hiç güncellenmez, referans eski konumda kalıcı olarak kilitlenirdi.

### Katman 2 — Yumuşatma (EMA)

Kabul edilen (sentinel/outlier olmayan) her okuma, o beacon'ın **Redis'teki** EMA'sını günceller:

```
yeni_EMA = emaAlpha × ham_okuma + (1 − emaAlpha) × eski_EMA
```

İlk okumada `EMA = ham_okuma`. Bu değer `beacon-signal:{userId}:{beaconId}` anahtarında saklanır (bkz. §6).

### Katman 3 — Salon içi birleştirme + Sinyal Kesintisi Toleransı

Bir salonun "gücü", ona atanmış (`HallBeacon.isActive`) beacon'ların EMA'larının **basit ortalamasıdır**. Ama bir beacon bu turda taze veri vermediyse (sentinel, outlier, veya telefon onu taramada hiç yakalayamadıysa) ne olur — burada **grace (sinyal kesintisi toleransı)** mekanizması devreye girer:

```
eğer (bu_turun_zamanı − beacon'ın_son_GERÇEKTEN_geçerli_okuması) ≤ staleGraceSeconds
  → o beacon'ın SON BİLİNEN EMA'sı (sönmeden, aynen) salon ortalamasına dahil edilmeye devam eder
değilse
  → o beacon adaylıktan tamamen düşer; eğer bir salonun HİÇBİR beacon'ı kalmadıysa o salon bu tur için hiç "yok" sayılır
```

Bu mekanizma, saha testinde bulunan ikinci gerçek hatanın (§9) doğrudan düzeltmesidir: tek beacon'lı bir salonun 1-2 turluk geçici kesintisinde salon anında aday listesinden düşüp rakip salona "ışınlanma" (aynı turda EXIT+ENTRY) oluyordu.

### Katman 4 — Salonlar arası karşılaştırma (softmax güven yüzdesi)

O an en az bir geçerli (taze veya grace ile donmuş) ortalaması olan **tüm salonlar** birbirine göre kıyaslanır:

```
P(salon) = exp(salon_ortalaması / confidenceTemperature) / Σ exp(diğer_salon_ortalaması / confidenceTemperature)
```

> **Kritik nokta:** Bu yüzde "sinyal kalitesi" ölçmez, **salonlar arası göreceliği** ölçer. Tek salon görünüyorsa sinyal ne kadar zayıf olursa olsun yüzde her zaman **%100** çıkar. Gerçek koruma bir sonraki adımdaki salon eşiğidir.

**Nihai aday:** en yüksek yüzdeye sahip **VE** kendi salon eşiğini (`Hall.rssiThreshold`) geçen salon. `HallBeacon.rssiThreshold` (beacon başına override) v3'te karar eşiği olarak **kullanılmıyor** — salon eşiği her zaman salon seviyesinde tek ve nettir.

### Katman 5 — Zaman içi doğrulama (histerezis + belirsizlik)

Saf, veritabanından bağımsız fonksiyon (`presence-transition.ts`), her snapshot için şu sırayla karar verir:

1. **Belirsizlik kontrolü:** Eşiği geçen ilk iki salonun yüzde farkı `ambiguityMarginPct`'ten azsa, sistem **zorla bir taraf seçmez** — durum `AMBIGUOUS` olur, adaylık sayaçları ne artar ne sıfırlanır (dondurulur). Açık bir ziyaret varsa ve o ziyaretin salonu belirsiz adaylardan biriyse, ziyaret canlı tutulur (`touch-last-confirmed`) — aksi hâlde iki salon arasındaki sınırda duran bir katılımcının tek bir uzun ziyareti, bayat-ziyaret süpürücüsü tarafından parçalanırdı.
2. **Kalma histerezisi (asimetrik eşik):** Zaten içeride olduğunuz salonun yüzdesi `exitProbabilityThreshold`'un (varsayılan 40) altına **2 ölçüm üst üste** düşerse çıkış sayılır. Bu, girmek için gereken eşikten (`entryProbabilityThreshold`, varsayılan 60) kasıtlı olarak daha düşük — aradaki bant, sinyal dalgalanmasında katılımcının salondan "atılmasını" önler. Salon eşiği (`passesThreshold`) burada da aranır: yalnızca yüzdeye bakılsaydı, koridora çıkmış ama hâlâ tek başına o salonu gören bir katılımcı %100 yüzdeyle sonsuza kadar "içerde" görünürdü.
3. **Giriş adaylığı:** Bir salona girmek için o salonun yüzdesi `entryProbabilityThreshold`'u **2 ölçüm üst üste** geçmeli. Aday salon değişirse sayaç sıfırdan başlar.
4. **Çıkış anı:** `endedAt`, o anki ölçüm zamanı değil, ziyaretin **son doğrulandığı an** (`lastConfirmedAt`) olarak kaydedilir — arada geçen süre katılımcının salonda olduğu kanıtlanamayan süredir.
5. **Salon değişimi:** Aday salon, açık ziyaretin salonundan farklıysa, giriş onaylandığı anda eski ziyaret kapatılır ve yenisi aynı transaction içinde açılır.

Sonuç olarak kullanıcının anlık durumu (`UserPresenceState.currentStatus`) üç değerden biri olur:

| Durum | Anlamı |
|---|---|
| `IN_HALL` | Bir salona net şekilde girilmiş, doğrulanmış |
| `AMBIGUOUS` | İki (veya daha fazla) salon arasında, yüzdeler birbirine çok yakın |
| `NO_SIGNAL` | **İki farklı gerçekliği kasıtlı olarak birleştirir**: (a) cihaz veri gönderiyor ama hiçbir salon eşiğini geçmiyor — zayıf sinyal, koridor; (b) cihaz tamamen sessiz. Ayrım kaybolmaz: Takip Sağlığı sayfası `lastObservationAt` üzerinden bu ikisini ayırabilir (bkz. §8.2). |

---

## 3. Ayarlanabilir parametreler (kongre bazlı, panelden)

Tümü `Congress` modelinde tutulur, ayrı bir `AlgorithmConfig` tablosu **yok** (bilinçli tasarım kararı — bkz. `docs/algoritma-v3-uygulama-talimati.md` §3).

| Parametre | Varsayılan | Sınır | Ne yapar |
|---|---|---|---|
| **Yumuşatma** (`emaAlpha`) | 0.35 | 0.01–1 | EMA'da yeni okumanın ağırlığı. Büyüdükçe daha hızlı tepki, daha az kararlılık. |
| **Outlier sıklığı** (`hampelK`) | 3 | 0.5–10 | Hampel filtresinin sıkılığı. Küçüldükçe daha çok okuma "anormal" sayılır. |
| **Outlier penceresi** (`hampelWindowSize`) | 5 | 3–20 | Medyan/MAD kaç son okumadan hesaplanır. |
| **Güven sıcaklığı** (`confidenceTemperature`) | 8 | 0.5–50 | Softmax'ın keskinliği. Büyüdükçe salon yüzdeleri birbirine yaklaşır. |
| **Giriş eşiği** (`entryProbabilityThreshold`) | 60 | 0–100 | Girmek için gereken yüzde (2 ölçüm üst üste). Çıkış eşiğinden **büyük olmalı** — DTO seviyesinde ve kısmi PATCH'te ayrıca zorunlu kılınır. |
| **Çıkış eşiği** (`exitProbabilityThreshold`) | 40 | 0–100 | Altına düşülünce çıkış sayılan yüzde (2 ölçüm üst üste). |
| **Belirsizlik payı** (`ambiguityMarginPct`) | 5 | 0–50 | İlk iki salonun yüzde farkı bunun altındaysa `AMBIGUOUS`. |
| **Sinyal kesintisi toleransı** (`staleGraceSeconds`) | 5 | 0–60 | Bir beacon'ın son geçerli okumasından sonra kaç saniye daha son bilinen EMA'sının kullanılmaya devam edeceği. |

Ayrıca (algoritmayla doğrudan ilgili olmayan ama kongre bazlı ayarlanabilen): `observationIntervalSeconds` — mobil cihazın batch gönderim sıklığı.

---

## 4. Veri modeli

| Tablo | Ne saklar |
|---|---|
| `BeaconObservation` | Ham veri — hiç değiştirilmeden, sonsuza kadar. Her okumanın `uuid/major/minor/rssi/observedAt`'i. |
| `ObservationBatch` | Bir batch gönderiminin özeti (kaç kabul/tekrar/red edildi). |
| `HallVisit` | Karar katmanının ürettiği "şu salonda şu kadar süre kaldı" kaydı. `confidenceLevel` (yüksek/orta/düşük, yüzdeden türetilir), `algorithmVersion`. |
| `AttendanceEvent` | Her ENTRY/EXIT anının kaydı. `confidenceScore` (v3'te 0-100 yüzde, v2'de ham dB marjı — karışmasın diye sorgular her zaman `algorithmVersion` filtreler), `decisionTrace` (JSON, "bu karar neden verildi"). |
| `UserPresenceState` | Kullanıcı başına TEK satır: o anki aday salon, aday/çıkış sayaçları, açık ziyaret id'si, `currentStatus`. |

**`decisionTrace` neden var:** Saha testinde "neden burada yanlış salon seçildi" sorusuna cevap verebilmek için. Şekli:

```json
{
  "candidates": [
    {
      "hallId": "...",
      "percentage": 87.43,
      "emaAverage": -59.15,
      "passesThreshold": true,
      "beaconReadings": [
        { "beaconId": "...", "emaValue": -61.29, "rawAccepted": false, "stale": true },
        { "beaconId": "...", "emaValue": -57.01, "rawAccepted": true }
      ]
    }
  ],
  "runnerUpGapPct": 100,
  "rejectedOutliers": 1,
  "algorithmVersion": "v3"
}
```

`rawAccepted:false` + `stale:true` = bu okuma taze değildi ama grace ile hâlâ ortalamaya dahil edildi (elenmedi). `rawAccepted:false` + `stale` yok = gerçekten elendi (Hampel/sentinel), ortalamaya hiç girmedi.

**`HallVisit` ↔ `AttendanceEvent` arasında yabancı anahtar yok** — ikisi aynı anda, aynı zaman damgasıyla üretiliyor (girişte `occurredAt = startedAt`, çıkışta `occurredAt = endedAt`); eşleştirme bu üçlü üzerinden yapılıyor. Kasıtlı: ham veriye ya da karar kayıtlarına yeni kolon eklemeye gerek kalmıyor.

---

## 5. Redis'in rolü

Beacon-sinyal çalışma belleği **kalıcı bir Prisma tablosu değil** — rapor/analitik verisi değil, yalnızca canlı karar hesaplaması için gereken geçici durum:

- `beacon-signal:{userId}:{beaconId}` → `{ emaValue, recentRssi[], updatedAt, lastAcceptedAt }`, TTL 8 saat.
- `beacon-signal-stats:{userId}` → `{ accepted, rejected }` sayaçları (Takip Sağlığı'ndaki "anormal okuma oranı" için).

**Redis'e erişilemezse sistem çökmez** — `BeaconSignalStore`'daki her çağrı `try/catch` ile sarılı. Okuma hatasında "geçmiş yok" gibi davranılır (ham okuma kabul edilir, EMA sıfırdan başlar); yazma hatası sessizce yutulur, bir sonraki snapshot yeniden dener. Redis'in kaybı kritik veri kaybı değildir, sistem yumuşatmasız/toleranssız çalışmaya devam eder.

---

## 6. Destekleyici mekanizma — Bayat Ziyaret Süpürücüsü

`StaleVisitSweepService` (BullMQ, her 2 dakikada bir çalışır): `lastConfirmedAt`'i 5 dakikadan eski, hâlâ "açık" görünen `HallVisit`'leri gerçekten kapatır (`confidenceLevel:'unknown'`, `algorithmVersion:'v1-stale-sweep'`) ve `UserPresenceState.currentStatus`'u `NO_SIGNAL`'e çeker. Bu, cihaz sessiz kaldığında (uygulama kapandı, Bluetooth kapalı) katılımcının panelde sonsuza kadar "içerde" görünmesini engelleyen ayrı, bağımsız bir güvenlik ağıdır — ana karar döngüsünden farklı olarak zaman tabanlı çalışır.

---

## 7. Panelde gördükleriniz — ekran ekran

### 7.1 Canlı Takip (`/attendance`)

| Bileşen | Kaynak | Ne gösterir |
|---|---|---|
| **Şu An İçeride** | `attendance/summary` → `currentlyInsideTotal` | O an `isOpen:true` olan `HallVisit` sayısı, tüm salonlar toplamı. |
| **Bugün Görülen Katılımcı** | `participantsSeenToday` | Bugün (sunucunun yerel gününe göre 00:00'dan itibaren) en az bir `HallVisit` başlatmış farklı kullanıcı sayısı. |
| **Aktif Salon** | `activeHalls` | Kongredeki toplam salon sayısı. |
| **Son Gözlem** | `lastObservationAt` | En son `BeaconObservation`'ın sunucuya ulaşma zamanı — "kaç saniye önce" olarak gösterilir. |
| **Salon Doluluğu** | `hallOccupancy` | Her salonda o an kaç açık ziyaret var. |
| **Şu An İçeride Olanlar** | `listHallVisits({isOpen:true})` | Salon başına, içeride olan katılımcıların isimleri ve ne kadardır orada oldukları (5 saniyede bir yenilenir). |
| **Kalış Süresi** | `durationStats` | **Yalnızca tamamlanmış (`endedAt` dolu) ziyaretler** üzerinden: ortalama, medyan (dakika) ve o salona yapılan girişlerin ortalama güven yüzdesi (`algorithmVersion='v3'` filtreli — v2'nin ham dB marjıyla karışmaz). **Önemli:** bu istatistikler kongre kurulduğundan beri BİRİKEN tüm geçmiş veriyi kapsar; test/deneme sırasında oluşan kısa ziyaretler de dahildir. |
| **Yoğunluk (Bugün)** grafiği | `occupancy-series`, 15dk aralık | Her 15 dakikalık dilimde, o dilimle çakışan `HallVisit` satırı sayısı — **DİKKAT: salonlar grafikte üst üste yığılmıştır** (`stackId="occupancy"`, kasıtlı tasarım). Görünen tepe değeri tek bir salonun değil, tüm salonların TOPLAMIdır. |
| **Katılımcı Salon Geçmişi** | `hall-visits` (sayfalanmış, filtrelenebilir) | Her satır bir `HallVisit`. "Güven" sütunu: v3 kayıtlarında yüzde + etiket (`%87 · yüksek`), eski/sweep kayıtlarında yalnızca etiket. |
| **Ham Gözlem Akışı (debug)** | `observations`, son 20 | Filtrelenmemiş, ham `BeaconObservation` satırları — sentinel (`rssi=0`) dahil, algoritmanın hiçbir katmanından geçmemiş hâliyle. Yalnızca açıldığı anda çeker, otomatik yenilenmez. |
| **Karar Gerekçesi (debug)** | `hall-visits/:id/trace` | Seçilen (v3) ziyaretin giriş ve varsa çıkış kararının tam `decisionTrace`'i — hangi salonlar, hangi yüzdeler, hangi beacon donmuş/elenmiş. |
| **Algoritma Ayarları** | `PATCH /congresses/:id` | §3'teki 7 parametrenin kongre bazlı düzenlenmesi. |
| **Mobil gönderim aralığı** | `observationIntervalSeconds` | Telefonun bir sonraki batch'i kaç saniye sonra göndereceği. |

### 7.2 Takip Sağlığı (`/tracking-health`)

**İki bağımsız durum ekseni** vardır, karıştırılmamalı:

- **Veri Akışı** (`aktif`/`yakın zamanda`/`veri yok`) — cihazın kaç saniye önce veri gönderdiğine bakar (≤2dk aktif, ≤10dk yakın zamanda, sonrası veri yok). Bu, algoritmanın karar katmanından tamamen bağımsız, sadece "cihaz canlı mı" sorusuna cevap verir.
- **Konum Durumu** (`İçeride`/`Belirsiz`/`Sinyal yok`) — algoritmanın ürettiği `currentStatus`. Cihaz "veri yok" durumundaysa, kayıtlı `currentStatus` ne olursa olsun burada **zorla** `Sinyal yok` gösterilir (aksi hâlde saatler önce kapanmış bir oturumdan kalma "İçeride" yanlış görünürdü).
- **Anormal Okuma** — Redis'teki `accepted`/`rejected` sayaçlarından `rejected / (accepted+rejected)`. Redis erişilemezse `—` gösterilir, sayfa yine çalışır.

### 7.3 Raporlar (`/reports`)

- **Veri Kalitesi:** Toplam gözlem, kayıtlı bir beacon'la eşleşen/eşleşmeyen sayısı ve oranı. Eşleşmeyen okuma, panelde tanımlı olmayan bir beacon'dan geliyor demektir (örn. yanlış UUID/major/minor).
- **Beacon Sağlığı:** Beacon başına gözlem sayısı, **ortalama RSSI** (sentinel `rssi≥0` hariç tutularak hesaplanır — yoksa ortalamayı olduğundan güçlü gösterirdi), o beacon'ı gören **farklı katılımcı sayısı** (kapsama alanı göstergesi), son görülme zamanı.
- **CSV indir:** `hall-visits` verisinin dışa aktarımı (aynı filtre mantığı, maks. 5000 satır).

---

## 8. Bilinçli tasarım kararları ve bilinen sınırlamalar

- **Güven yüzdesi ≠ sinyal kalitesi.** Tek salon görünüyorsa yüzde her zaman %100'dür. Gerçek koruma her zaman `Hall.rssiThreshold`.
- **`NO_SIGNAL` iki gerçekliği birleştirir** (zayıf sinyal / sessiz cihaz) — bilinçli basitleştirme, ayrım Takip Sağlığı'ndan yapılabilir.
- **Yoğunluk grafiği yığılmıştır (stacked)** — salon başına ayrı çizgi değil, kümülatif toplam.
- **Kalış süresi/Katılımcı Geçmişi istatistikleri geçmişi filtrelemez** — kongre boyunca birikmiş tüm veriyi (test dahil) kapsar.
- **`AuditLog`, bir kongrenin GÜNCELLENDİĞİNİ ve NE ZAMAN kaydeder, ama HANGİ ALANLARIN neye değiştiğini kaydetmez.**
- **Hampel penceresi ve grace mekanizması** saha testinde bulunan iki gerçek hatanın düzeltmesidir (ayrıntı: `docs/decisions.md`).

---

## 9. Kısa sözlük

| Terim | Anlamı |
|---|---|
| EMA | Üstel Hareketli Ortalama — yeni ölçüme ağırlık veren, geçmişi tamamen atmayan yumuşatma. |
| MAD | Medyan Mutlak Sapma — medyandan sapmaların medyanı; standart sapmaya benzer, uç değerlere karşı dayanıklı. |
| Softmax | Bir grup sayıyı, toplamı 100 olan göreceli yüzdelere çeviren fonksiyon. |
| Histerezis | Girmek ve kalmak için farklı (asimetrik) eşik kullanma — dalgalanmaya karşı kararlılık sağlar. |
| Grace / Stale | Bir beacon'ın son geçerli okumasından belli bir süre sonrasına kadar "hâlâ güvenilir" sayılıp donmuş EMA'sının kullanılmaya devam etmesi. |
| `decisionTrace` | Bir kararın tüm gerekçesini tutan JSON kayıt. |
