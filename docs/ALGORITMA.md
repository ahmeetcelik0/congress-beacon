# Salon Tespit Algoritması

Bu doküman, katılımcının telefonundan gelen ham iBeacon sinyallerinin nasıl
"şu an X salonunda" kararına dönüştüğünü anlatır. Kod: `backend/src/attendance/`
(`signal/signal-math.ts`, `signal/beacon-signal-store.ts`,
`presence-transition.ts`, `attendance-processing.service.ts`).

## Problem

Mobil uygulama backend'e ham RSSI (sinyal gücü) okumaları gönderir — hangi
beacon'ın ne kadar güçlü göründüğü. Bu ham veri gürültülüdür: aynı beacon'a
sabit duran bir telefon bile art arda farklı RSSI değerleri okur, iki salon
birbirine yakınsa sinyaller karışır, bir kişi salonun kapısında dururken iki
salonu da benzer güçte görebilir. Algoritmanın işi bu gürültüden **tek bir
katılımcının şu an hangi salonda olduğuna** dair güvenilir bir karar
çıkarmak — ve bu kararı ne zaman değiştireceğine (girdi/çıktı) karar vermek.

Karar **her zaman backend'de** verilir, mobil uygulama hiçbir salon kararı
vermez — yalnızca ham beacon anlık görüntüsünü gönderir (bkz.
`docs/MIMARI.md` "Ham veri / backend-karar mimarisi").

## Beş katman

Bir gözlem batch'i geldiğinde, her snapshot için sırayla:

### Katman 1 — Veri kalitesi kapısı

- **Sentinel filtresi**: `rssi >= 0` gerçek bir ölçüm değil, "bu taramada
  değer alınamadı" sinyalidir (CoreLocation/flutter_beacon bazen böyle
  döner). Bu değerler tamamen atılır — ortalamaya karışırsa, zayıf bir
  beacon'ın ara sıra dönen `0`'ı başka bir salonun gerçek (negatif) RSSI'sinden
  sayısal olarak "daha güçlü" görünüp sahte, ani salon geçişlerine
  ("ışınlanma") yol açar.
- **Hampel outlier filtresi**: son `hampelWindowSize` (varsayılan 5) okumadan
  medyan ve MAD (medyandan mutlak sapmaların medyanı) hesaplanır; yeni okuma
  `|x − medyan| > hampelK · MAD` ise "aykırı" sayılıp bir sonraki katmana
  (EMA) **beslenmez**. İki özel durum:
  - Pencere henüz dolmadıysa (`< hampelWindowSize` örnek) filtre devre dışıdır
    — az örnekle hesaplanan medyan/MAD güvenilmezdir.
  - `MAD = 0` ise filtre devre dışıdır — telefon sabit dururken RSSI aynı
    değere kuantalanır, bu durumda `k·0` kuralı medyandan 1 dB farklı her
    okumayı reddedip filtreyi kilitler.
  - **Pencerenin kendisi outlier kararından bağımsız, koşulsuz kayar**
    (yalnızca "EMA'ya beslensin mi" kararı outlier'dan etkilenir). Yalnızca
    kabul edilen okumalar pencereye girseydi, pencere homojenleşip MAD
    küçülür, katılımcı gerçekten hareket ettiğinde tüm yeni okumalar
    reddedilip referans eski konumda kalıcı olarak kilitlenirdi — bu, saha
    testinde gerçekten yaşanmış ve düzeltilmiş bir hatadır.

### Katman 2 — EMA yumuşatma

Kabul edilen okumalar üstel hareketli ortalamaya (`EMA(t) = α·RSSI(t) +
(1−α)·EMA(t−1)`, ilk okumada `EMA(0) = RSSI(0)`) beslenir. `emaAlpha`
(varsayılan 0.35) ne kadar yüksekse yeni okumaya o kadar ağırlık verilir —
tepki hızı ile gürültü bastırma arasındaki denge.

**Grace-süresi (stale-fallback) mekanizması**: bir beacon bu turda hiç
görünmediyse veya reddedildiyse ama son *gerçekten kabul edilen* okumasının
üzerinden `staleGraceSeconds` (varsayılan 5sn) saniyeden azı geçtiyse, o eski
(donmuş) EMA değeriyle **hâlâ** salon ortalamasına dahil edilir. Bu, saha
testinde bulunan bir "ışınlanma" hatasını düzeltir: tek bir beacon'ın 1-2
turluk geçici düşüşü, o salonu anında "aday dışı" bırakıp rakip (aslında
daha zayıf) bir salonun tek aday kalmasına yol açmasın diye.

### Katman 3 — Salon içi birleştirme

Aynı salona atanmış beacon'ların (o an geçerli/grace içindeki) EMA'ları
ortalanır. Bu ortalama, salonun `rssiThreshold`'u (varsayılan −70 dBm,
salon başına ayarlanabilir) ile karşılaştırılır — **karar eşiği her zaman
tek ve nettir: `Hall.rssiThreshold`**. (`HallBeacon.rssiThreshold` alanı
şemada durur ama karar eşiği olarak kullanılmaz — kasıtlı bir sadeleştirme.)

### Katman 4 — Salonlar arası güven yüzdesi (softmax)

Eşiği geçen/geçmeyen tüm salonların ortalamaları, toplamı 100 olan yüzdelere
çevrilir: `P(salon) = exp(ortalama/T) / Σ exp(ortalama_j/T)` (log-sum-exp ile
sayısal taşma güvenli). `confidenceTemperature` (varsayılan 8) yüzdelerin ne
kadar "keskin" ayrıştığını belirler.

**Kritik davranış — bu yüzde bir sinyal kalitesi ölçüsü DEĞİLDİR, salonlar
arası göreceliktir.** Tek salon görünüyorsa sinyal −95 dBm bile olsa yüzde
**%100** çıkar. Gerçek koruma her zaman Katman 3'ün `Hall.rssiThreshold`
kapısıdır — panelde yüzde rozetinin yanında salon-eşiği geçme bilgisi de
gösterilir, bu ikisi karıştırılmamalı.

Nihai aday: **en yüksek yüzdeye sahip VE kendi salon eşiğini geçen** salon.
Yalnızca eşiği geçen salonlar arasında ilk iki aday arasındaki fark
`ambiguityMarginPct`'ten (varsayılan 5) küçükse durum **belirsiz**
sayılır — eşiği geçmeyen zayıf bir salon bu karşılaştırmaya hiç girmez
(aksi halde koridorda duran, iki salonu da zayıf gören bir katılımcı sürekli
"belirsiz" sayılır, çıkış sayacı donar, açık ziyareti hiç kapanmazdı).

### Katman 5 — Zaman içinde doğrulama ve durum geçişi

Saf, veritabanından bağımsız bir fonksiyon (`presence-transition.ts`) —
girdi olarak önceki durumu (`candidateHallId`, streak sayaçları, açık
ziyaret) ve o turun kararını alır, hangi efektlerin (`open-visit`,
`close-visit`, `touch-last-confirmed`) uygulanacağına karar verir:

- **Giriş**: aynı salon adayı **2 ardışık tur** (`entryProbabilityThreshold`,
  varsayılan %60, üstünde) üst üste çıkarsa ziyaret açılır. Tek bir turluk
  sıçrama giriş üretmez.
- **Kalma histerezisi (asimetrik eşik)**: açık bir ziyaret varsa, kalmak için
  giriş eşiği değil daha düşük `exitProbabilityThreshold` (varsayılan %40)
  yeterlidir — **VE** salon eşiği (`passesThreshold`) hâlâ geçilmelidir. Bu
  asimetrinin amacı: %60 ile gir, ama %45'e düşünce hemen çıkma — ancak
  koridora çıkıp aynı salonu %100 yüzdeyle (tek aday olarak) görmeye devam
  eden biri de sonsuza dek "içeride" sayılmasın diye eşik kontrolü ayrıca
  aranır.
- **Çıkış**: ardışık **2 tur** kalma koşulunu sağlamazsa ziyaret kapanır.
  Çıkış anı, son *doğrulanmış* an (`lastConfirmedAt`) olarak kaydedilir —
  aradaki süre katılımcının salonda olduğu kanıtlanamayan süredir.
- **Belirsizlik**: streak sayaçları **donar** (ne artar ne sıfırlanır) —
  belirsizlik "yeni kanıt yok" demektir, ne mevcut kanıtı silmek ne yeni
  kanıt saymak doğru olur. Açık ziyaretin salonu belirsiz adaylardan biriyse
  ziyaret `lastConfirmedAt` ile canlı tutulur (giriş/çıkış tetiklenmez) —
  aksi halde iki salon arasındaki sınırda duran bir katılımcının tek bir
  60 dakikalık ziyareti, bayat-ziyaret temizliği tarafından 5 dakikada bir
  kapatılıp onlarca parçaya bölünür, kalış süresi istatistiklerini bozardı.

## Durum modeli: `PresenceStatus`

Üç değer: `IN_HALL` (açık ziyaret var), `AMBIGUOUS` (belirsizlik), `NO_SIGNAL`
(diğer her durum). **`NO_SIGNAL` bilinçli olarak iki farklı gerçekliği
birleştirir**: (a) cihaz veri gönderiyor ama hiçbir salon eşiğini/giriş
yüzdesini geçmiyor — zayıf sinyal, koridor, kalibrasyonsuz bölge; (b) cihaz
tamamen sessiz — Bluetooth kapalı, uygulama durmuş. Ayrım kaybolmuyor, yalnızca
tek alanda taşınmıyor: Takip Sağlığı sayfası (`GET /admin/tracking-health`)
`lastObservationAt` üzerinden bu ikisini zaten ayırt ediyor (`aktif`/
`yakin_zamanda` iken `NO_SIGNAL` = zayıf sinyal; `veri_yok` iken = sessiz
cihaz).

## Redis'in rolü ve arızaya dayanıklılık

Her beacon'ın son EMA'sı + kayan pencere `BeaconSignalStore` (Redis, 8 saat
TTL) üzerinde tutulur. **Redis'e her erişim (`loadMany`/`saveMany`/
`bumpCounters`) try/catch ile sarılı** — Redis kapalıyken veya zaman
aşımına uğradığında hata yukarı fırlatılmaz, sistem yumuşatmasız (her
okumayı doğrudan kabul ederek, `EMA(0) = RSSI(0)`'dan yeniden başlayarak)
çalışmaya devam eder. Redis'in kaybı kalıcı veri kaybı değildir ve karar
üretimini durdurmaz — pencere birkaç ölçümde kendiliğinden yeniden dolar.

## Kalibrasyon parametreleri (panelden kongre başına ayarlanabilir)

| Parametre | Varsayılan | Anlamı |
|---|---|---|
| `emaAlpha` | 0.35 | EMA tepki hızı |
| `hampelK` | 3 | Hampel filtresi hassasiyeti (kaç MAD'den sonra aykırı) |
| `hampelWindowSize` | 5 | Hampel/EMA-grace penceresinin okuma sayısı |
| `confidenceTemperature` | 8 | Softmax "keskinlik" (düşük = daha keskin ayrım) |
| `entryProbabilityThreshold` | %60 | Girmek için gereken minimum yüzde |
| `exitProbabilityThreshold` | %40 | Kalmak için gereken minimum yüzde |
| `ambiguityMarginPct` | 5 | Belirsizlik için ilk iki aday arası azami fark |
| `staleGraceSeconds` | 5 | Bir beacon'ın "hâlâ geçerli" sayıldığı bekleme süresi |
| `Hall.rssiThreshold` | −70 dBm | Salon-seviyesi tek karar eşiği |

**Doğrulama kuralı**: `entryProbabilityThreshold` her zaman
`exitProbabilityThreshold`'dan büyük olmalıdır (hem DTO seviyesinde hem
`congress.service.ts`'de kısmi `PATCH`'e karşı ikinci kez kontrol edilir) —
aksi halde histerezis çöker: kullanıcı girer girmez çıkmış sayılır, sistem
her ölçümde giriş/çıkış üretir.

## Karar izi (`decisionTrace`)

Her `AttendanceEvent` (ENTRY/EXIT), o kararı üreten tüm salon adaylarını,
yüzdelerini, hangi beacon okumalarının kabul/red edildiğini
(`decisionTrace` JSON alanı) taşır — "bu karar neden verildi" sorusuna
geriye dönük cevap verebilmek için. Kesin bir şema zorunlu tutulmadı; amacı
saha testinde yanlış salon seçimlerini teşhis edebilmek.

## Sürüm etiketi

Her `HallVisit`/`AttendanceEvent` bir `algorithmVersion` taşır (şu an
`'v3'`). Eski `'v2'` kayıtlar (basit eşik + iki-ardışık-ölçüm kuralı,
yumuşatma yok) dokunulmadan durur — panel raporları algoritma sürümüne göre
ayrım yapabilir (ör. ortalama güven skoru yalnızca `v3` ziyaretlerden
hesaplanır, `v2`'nin farklı anlamdaki değerleriyle karışmasın diye).
