# Salon Tespit Algoritması V3 — Kod İnceleme Sunumu

**İnceleme tarihi:** 23 Temmuz 2026  
**İncelenen sürüm:** `bd14aec` (`feat: salon tespit algoritmasini v3'e yukselt`) ve mevcut çalışma ağacı  
**İnceleme türü:** Kod, şema, migration, test, mobil akış, web paneli ve üç V3 dokümanının karşılaştırmalı incelemesi  
**Değişiklik:** Bu rapor dışında hiçbir ürün kodu, migration veya yapılandırma değiştirilmedi.

---

## Slayt 1 — Yönetici özeti

V3'ün çekirdek yaklaşımı **doğru tasarlanmış ve büyük ölçüde doğru uygulanmış**:

- Ham RSSI mobilde karar verilmeden backend'e geliyor.
- Hampel, EMA, salon içi ortalama, softmax, histerezis ve ambiguity katmanları ayrılmış.
- Redis çalışma belleği, Prisma kalıcı verisi ve karar izi doğru rollerle kullanılıyor.
- V3 için 59 Jest testi geçiyor; Prisma şeması, backend production build'i, web lint/type-check ve Flutter analyzer geçiyor.

Ancak bu sürüm için **production/server onayı vermiyorum**. Bunun nedeni algoritmanın fikrinin yanlış olması değil; gerçek cihaz ve eşzamanlı trafik altında attendance sonucunu bozabilecek aşağıdaki açıkların bulunmasıdır:

1. Mobil uygulama kongrenin gerçek beacon UUID'sini almıyor; sabit bir UUID tarıyor.
2. Android release manifest'i ağ ve beacon izinlerini içermiyor.
3. Ham observation kaydı ile attendance işleme atomik değil; hata sonrası bir snapshot kalıcı olarak attendance sonucundan mahrum kalabilir.
4. `staleGraceSeconds=5`, mobil foreground taramasının 6–10 saniyelik kör aralığından kısa; grace mekanizması hedeflediği geçici kesintiyi normal kullanımda koruyamayabilir.
5. Aynı kullanıcı için paralel/gecikmiş batch'lerde zaman sırası ve state yarışları korunmuyor.
6. Tam TypeScript kontrolü V3 test fixture'larındaki `lastAcceptedAt` alanı eksik olduğu için başarısız; E2E test ise hiç başlamıyor.

**Karar:** Kontrollü bir staging ortamına, bu riskler açıkça kabul edilerek yalnızca gözlemsel test amacıyla yükleme düşünülebilir. Gerçek katılım verisi veya production için önce P0/P1 maddeleri kapatılmalı.

---

## Slayt 2 — İnceleme kapsamı ve kanıtlar

İncelenen temel kaynaklar:

- Tasarım/talimat: `docs/algoritma-v3-uygulama-talimati.md`
- Değişiklik gerekçesi: `docs/algoritma-v3-degisiklik-ozeti.md`
- Güncel referans: `docs/algoritma-v3-referans-rehberi.md`
- Karar kayıtları ve saha protokolü: `docs/decisions.md`, `docs/saha-testi-protokolu-ev.md`
- Karar motoru: `backend/src/attendance/`
- Observation ingestion: `backend/src/observations/`
- Prisma ve migration'lar: `backend/prisma/`
- Kongre ayarları, tracking health, raporlar, mobil ve web paneli

Çalıştırılan kontroller:

| Kontrol | Sonuç | Not |
|---|---:|---|
| `backend npm test -- --runInBand` | Geçti | 6 suite, 59 test |
| `backend npm run build` | Geçti | Production build, test dosyaları hariç |
| `backend npx tsc -p tsconfig.json --noEmit --incremental false` | **Başarısız** | 6 V3 test fixture'ında `lastAcceptedAt` eksik |
| `backend npx prisma validate` | Geçti | Şema geçerli |
| `backend npx eslint ...` | Geçti | Kaynak lint'i |
| `backend npm run test:e2e -- --runInBand` | **Başarısız** | Prisma generated client / `ts-jest` çözümleme hatası; 0 test çalıştı |
| `web npm run lint` | Geçti | |
| `web npx tsc --noEmit` | Geçti | |
| `mobile flutter analyze` | Geçti | Sorun bulunmadı |
| `mobile flutter test` | Atlandı | Tek test bilerek `skip` |

Not: Önceki `TEST-RAPORU.md` 20 Temmuz 2026 ve V3 commit'i 23 Temmuz 2026 tarihli. Bu nedenle eski rapor V3'ün uçtan uca doğrulaması olarak kullanılamaz.

---

## Slayt 3 — V3 algoritmasının kodda gerçek akışı

```text
Flutter beacon ranging
  → POST /observations/batch
  → ObservationIngestionService
      → ObservationBatch + BeaconObservation (ham, değiştirilmemiş kayıt)
      → AttendanceProcessingService
          1. Sentinel / Hampel
          2. EMA (Redis)
          3. Salon içi ortalama
          4. Softmax yüzdesi + salon eşiği
          5. Histerezis / AMBIGUOUS / visit event'leri
      → HallVisit + AttendanceEvent + UserPresenceState
  → Next.js panel / tracking health / raporlar
```

Bu ayrım doğru bir mimari karardır: mobil istemci ham telemetri üretir; salon kararı, sürümlenme ve audit backend'de kalır.

---

## Slayt 4 — Talimat dokümanına göre kabul kriteri matrisi

| Talimat maddesi | Durum | Kod gözlemi |
|---|---|---|
| Redis'te kullanıcı×beacon geçici state | Tamam | `BeaconSignalStore`, 8 saat TTL |
| Yeni kalıcı sinyal tablosu yok | Tamam | Yalnızca Prisma alan/migration değişimi var |
| Hampel + EMA ayrı/test edilebilir modül | Tamam | `signal-math.ts`, `beacon-signal-store.ts` |
| `ALGORITHM_VERSION='v3'` | Tamam | Karar motorunda sabit `v3` |
| 0–100 confidence score | Tamam | ENTRY/EXIT event'lerine yüzde yazılıyor |
| `decisionTrace` | Büyük ölçüde tamam | Normal ENTRY/EXIT'te var; stale-sweep EXIT'inde yok |
| `currentStatus` | Tamam | `IN_HALL`, `AMBIGUOUS`, `NO_SIGNAL` |
| Salon seviyesi RSSI eşiği | Tamam | `Hall.rssiThreshold` kullanılıyor |
| Softmax + ambiguity | Tamam, bir kenar hatası var | Aşağıdaki P1 bulgusuna bakın |
| Kongre bazlı tuning + panel | Tamam | 8 parametre, panelden PATCH |
| Ham observation sözleşmesi değişmemeli | Tamam | Request alanları korunmuş |
| Yeni analitik endpoint'ler | Tamam | Summary, trace, user summary, tracking health, beacon health |
| Web görünümü | Tamam | Yüzde, trace, health, rapor alanları var |
| Birim testleri | Kısmi | Mantık testli, ama tam TS type-check kırık ve E2E yok |
| Replay/ayrı config/telemetry eklenmemesi | Tamam | Kapsam dışı altyapılar eklenmemiş |

---

## Slayt 5 — Doğru uygulanan kritik parçalar

### 1. Sinyal katmanları

- `rssi >= 0` sentinel değeri karar hesabından dışlanıyor.
- Hampel, pencere dolmadan eleme yapmıyor.
- `MAD = 0` durumunda filtre devre dışı; sabit RSSI durumunda kalıcı kilitlenmeyi önlüyor.
- EMA formülü ve log-sum-exp güvenli softmax doğru uygulanmış.
- Softmax yüzdesinin sinyal kalitesi değil, salonlar arası görecelik olduğu kod yorumlarında ve panelde doğru anlatılmış.

### 2. Saha testinde bulunan iki düzeltme

İlk uygulama talimatından iki bilinçli sapma var ve ikisi de `docs/decisions.md` ile kayıt altına alınmış:

- Hampel penceresi outlier olsa bile kayıyor. Bu, gerçek hareket sırasında referansın eski konumda kilitlenmesini önlüyor.
- `staleGraceSeconds`, kısa süreli sentinel/eksik beacon durumunda son EMA'yı koruyor. Bu, tek beacon'lı bir salonun aniden adaylıktan düşmesini azaltıyor.

Bunlar talimatla yüzeysel olarak çelişse de **hata değildir**; gerekçeli ve kodla uyumlu tasarım düzeltmeleridir.

### 3. Karar denetlenebilirliği

- ENTRY/EXIT kararında aday salonlar, yüzdeler, EMA'lar, eşik sonucu, grace ve elenen okumalar JSON trace olarak tutuluyor.
- V3 yüzdeleri v2'nin eski dB marjıyla analitik sorgularda karıştırılmıyor.
- Tracking Health, data-flow sağlığı ile algoritmik konum durumunu ayrı eksenler olarak gösteriyor.

---

## Slayt 6 — Dokümanlar arası doğruluk durumu

### `algoritma-v3-uygulama-talimati.md`

Bu dosya bir **uygulama talimatı/tarihsel spesifikasyon** olarak başarılı; fakat bugünkü kodun birebir referansı değildir.

- “Reddedilen outlier state'i değiştirmez” kuralı artık geçerli değil; bu değişiklik `decisions.md` içinde doğru gerekçeyle açıklanmış.
- “Sinyal yok” için örnek 2 dakika derken, mevcut uygulamada stale sweep 5 dakika, sweep periyodu 2 dakika ve Tracking Health “veri yok” eşiği 10 dakika kullanıyor.
- Check-list hâlâ boş ve dosya metni V2'yi “mevcut durum” gibi anlatıyor. Dosyanın tarihsel/tasarım belgesi olarak etiketlenmesi gerekir.

### `algoritma-v3-degisiklik-ozeti.md`

Gerekçe ve hedefler iyi anlatılmış. Ancak başlıktaki durum “Onaylandı, uygulanmayı bekliyor” ifadesi artık güncel değil; V3 commit'i mevcut.

### `algoritma-v3-referans-rehberi.md`

Güncel koda en yakın doküman budur ve ana mekanizmaları doğru anlatır. Aşağıdaki üç noktada düzeltme gerekir:

1. Telefonun snapshot'ı “her ~1 saniye” gönderdiği söyleniyor. Mobil kodda sabit 1 saniye ritmi yok; foreground'da 4 saniye ranging / 10 saniye cycle var, stream frekansı plugin'e bağlıdır.
2. Belirsizlikte açık ziyaretin “eşiği geçen ilk iki adaydan biriyse” touch edildiği yazıyor. Kod ham skorların ilk ikisini kontrol ediyor; eşik geçmeyen yüksek yüzdeli bir salon araya girerse bu vaat bozuluyor.
3. `staleGraceSeconds=5` varsayımı, foreground tarama boşluğu ile birlikte belgelenmeli; mevcut mobil ritimle bu değer çoğu durumda kısa kalır.

---

## Slayt 7 — P0: Server/gerçek cihaz testini engelleyen bulgular

### P0-1 — Mobil beacon UUID'si kongre konfigürasyonundan alınmıyor

**Kanıt:** `BeaconObservationService`, sabit `_defaultRegionUuid` kullanıyor. Pilot login cevabı gerçek `congress.beaconUuid` alanını taşısa da bu değer depolanıp observation servisine verilmemiş. `GET /mobile/bootstrap` endpoint'i ve mobil endpoint sabiti var, fakat çağrısı yok.

**Etki:** Saha protokolünde oluşturulacak “Ev Testi” veya yeni kongrenin UUID'si sabit UUID ile aynı değilse telefon hiç beacon görmez. Panel konfigürasyonu doğru olsa bile gerçek beacon verisi backend'e ulaşmaz.

**Neden kritik:** V3 algoritması gerçek RSSI almadan test edilemez.

### P0-2 — Android release uygulaması gerekli izinleri içermiyor

**Kanıt:** Ana Android manifest'te `INTERNET`, Bluetooth scan/connect ve gereken konum izinleri yok; `INTERNET` yalnızca debug/profile manifest'lerinde. Release signing de debug anahtarıyla tanımlı.

**Etki:** Android release uygulaması API'ye erişemeyebilir ve iBeacon taraması yapamayabilir.

**Neden kritik:** Saha testini Android cihazda yapmak veya Android release dağıtmak güvenilir değildir.

### P0-3 — Observation kaydı ve attendance kararı tek güvenilir işlem değil

**Akış:** Önce ham observation DB'ye yazılıyor; sonra controller aynı request içinde attendance processor'ı çağırıyor.

**Hata senaryosu:** Ham kayıt başarılı, attendance transaction hata verir, istemci request'i başarısız görüp retry eder. Retry'da `observationId` duplicate sayılır ve `acceptedSnapshots` boş kalır; processor tekrar çağrılmaz. Böylece ham veri kalır fakat ENTRY/EXIT/visit hiç oluşmayabilir.

**Etki:** Sessiz ve kalıcı attendance kaybı. Bu, sadece test değil gerçek veri bütünlüğü problemidir.

---

## Slayt 8 — P1: Algoritma mantık ve eşzamanlılık hataları

### P1-1 — Ambiguity touch yanlış aday kümesini kullanıyor

`computeDecision` ambiguity'yi **eşik geçen** iki salon üzerinden hesaplıyor. Buna karşılık `presence-transition.ts`, açık ziyaret salonunun ambiguity adaylarından biri olup olmadığını `decision.scores.slice(0, 2)` ile, yani **tüm ham skorların** ilk ikisi üzerinden kontrol ediyor.

Örnek:

```text
Salon X: %55, eşiği geçmiyor
Salon B: %24, eşiği geçiyor
Salon A: %21, eşiği geçiyor
```

B ve A arasındaki fark ambiguity sınırının altındaysa açık A ziyareti korunmalı. Kod ilk iki ham skora X+B baktığı için A'yı bulamaz, `lastConfirmedAt` güncellenmez ve aktif veri gelmesine rağmen stale sweep ziyareti kapatabilir.

### P1-2 — `staleGraceSeconds=5`, foreground scan boşluğundan kısa

Mobil foreground davranışı 4 saniye tarama ve 10 saniye cycle'dır. Son geçerli RSSI ile sonraki ranging penceresi arasındaki boşluk 6–10 saniyeye çıkabilir. Varsayılan grace ise 5 saniye.

**Etki:** Grace, normal duty-cycle sonrasında kayıp beacon'ı korumaz; tam çözmek için eklendiği “tek beacon kesildi, rakip salon %100 oldu” senaryosu tekrar görülebilir.

Bu yalnızca kalibrasyon konusu değildir; iki katmanın zaman varsayımları birbirini tutmuyor.

### P1-3 — Batch'ler arası zaman sırası korunmuyor

Bir batch kendi içinde `observedAt`'e göre sıralanıyor; farklı batch'ler arasında monotonic sıra, son işlenme zamanı veya clock-skew koruması yok.

**Etki:** Offline kalmış eski bir batch yeni batch'ten sonra gelirse EMA, `lastAcceptedAt`, aday streak'i ve `lastConfirmedAt` geriye gidebilir. Bir sonraki stale/grace hesabı yanlış sonuç üretir.

### P1-4 — Aynı kullanıcı için paralel request yarışları

`UserPresenceState` önce okunup sonra create/update ediliyor; kullanıcı başına lock, queue veya optimistic version yok.

**Etki:** Aynı kullanıcı iki cihazdan ya da ağ retry'ından paralel batch gönderirse iki açık visit, yanlış streak veya kayıp state güncellemesi oluşabilir.

### P1-5 — Stale sweep ile canlı processor yarışıyor

Sweep önce stale ziyaret listesini okuyor, sonra yalnızca ID üzerinden koşulsuz update yapıyor. Arada canlı processor ziyaretin `lastConfirmedAt` değerini yenilese bile sweep onu kapatıp EXIT event üretebilir.

**Etki:** Yanlış EXIT ve duplicate/bozuk ziyaret geçmişi.

---

## Slayt 9 — P1/P2: Veri, metrik ve karar semantiği sorunları

### İstemci zamanına aşırı güven

`observedAt` istemci tarafından belirleniyor; gelecekte, çok eski veya geriye giden timestamp için sınır yok.

- Gelecekteki zaman stale sweep'i uzun süre engelleyebilir.
- Çok eski zaman açık ziyareti hemen stale gösterebilir.
- Clock drift ve offline retry yukarıdaki sıralama hatasını büyütür.

### “Outlier” metriği sentinel'ları da sayıyor

`rejectedOutliers` ve Tracking Health `outlierRejectionRate` sayacı, Hampel outlier'ı ile `rssi >= 0` sentinel'ını aynı `rejected` sayacında topluyor.

**Etki:** Panelde “anormal okuma” oranı fiziksel RF gürültüsü ile plugin/OS'un geçersiz RSSI üretimini ayırt edemez. Metrik yanlış adlandırılmış ve saha kalibrasyonunu yanıltabilir.

### Trace bütünlüğü sınırlı

`HallVisit` ile `AttendanceEvent` arasında foreign key yok; trace kullanıcı + salon + aynı timestamp üçlüsüyle aranıyor. Eşzamanlı/tekrarlı event durumunda yanlış event seçilebilir. Stale-sweep EXIT'inde de karar izi doğal olarak boş kalır.

### Boş scan sonucu ile normal çıkış

Mobil `result.beacons.isEmpty` olduğunda snapshot göndermiyor; DTO da boş beacon dizisini reddediyor. Bu nedenle katılımcının gerçekten kapsama dışına çıkması çoğunlukla iki-snapshot EXIT kuralıyla değil, 5–7 dakika gecikmeli stale sweep ile sonuçlanır.

Bu, “veri gelmemesi çıkış kanıtı değildir” ilkesine uygun muhafazakâr bir tercih olabilir; fakat saha protokolündeki “uzaklaşınca birkaç dakika içinde EXIT” beklentisi deterministik değildir.

---

## Slayt 10 — Test altyapısı ve kalite kapısı açıkları

### 1. Jest başarılı, fakat tam TypeScript başarısız

`BeaconSignalState.lastAcceptedAt` tipte zorunlu. V3 test fixture'larının bir kısmında bu alan yok. Jest transpile ederek testleri geçiriyor, ama `tsc --noEmit` altı hata veriyor.

Bu bir test-fixture sorunu gibi görünse de runtime parser'ın alanı opsiyonelmiş gibi kabul etmesiyle tip sözleşmesinin çeliştiğini de gösterir.

### 2. E2E suite hiç çalışmıyor

`test/jest-e2e.json`, Prisma'nın `.js` uzantılı generated import'larını `.ts` kaynaklarına yönlendiren mapper'ı içermiyor. Sonuç: `Cannot find module './internal/class.js'`; 0 E2E test.

Üstelik mevcut E2E testi yalnızca varsayılan `GET / → Hello World` endpoint'ini deniyor. Attendance V3 için gerçek bir entegrasyon kanıtı yok.

### 3. Mobil test yok

Flutter analyzer temiz, fakat tek widget testi atlanmış. Beacon ranging, UUID bootstrap, offline retry, duty cycle, batch silme ve 401 akışını doğrulayan otomasyon yok.

### 4. Gerçek saha testi V3 için henüz kanıt değil

Eski test raporu V3 commit'inden önce. Ayrıca V3 saha protokolü gerçek UUID isteyen yeni kongre akışını anlatırken mobil uygulama UUID'yi sabit koddan alıyor.

---

## Slayt 11 — Ölü kod, yarım altyapı ve gereksiz karmaşıklık

| Öğe | Durum | Neden sorun |
|---|---|---|
| `HallBeacon.rssiThreshold` | Fiilen ölü konfigürasyon | Kaydediliyor ve UI/API'de dönüyor, V3 kararında okunmuyor |
| Mobil `ApiEndpoints.mobileBootstrap` | Kullanılmıyor | Endpoint var, ama uygulama çağırmadığı için dinamik kongre UUID/topolojisi devre dışı |
| `BeaconTestPage` | Debug/prototip | İstemci tarafında ayrı, sabit iki salon algoritması çalıştırıyor; gerçek backend V3'ü temsil etmiyor |
| `navigatorKey` | İşlevsel olarak kullanılmıyor | Tanımlı/passed, doğrudan okunmuyor |
| `CurrentAdmin` decorator | Kullanılmıyor | Admin controller'larında aktif kullanım yok |
| `UserRole.ADMIN` | Büyük ölçüde ölü | Gerçek admin modeli `AdminUser`; participant `UserRole.ADMIN` için akış yok |
| `getUserAttendanceSummary`, `updateSession` web client fonksiyonları | UI'da kullanılmıyor | API yüzeyi ve istemci tipleri gereksiz genişliyor |
| Push notification sender | Stub | `LoggingNotificationSender` gerçek push göndermeden `true` döndürüyor; log status `SENT` oluyor |
| Push init / opened akışı | Yarım | Mobilde Firebase TODO; gerçek notification log ID'si payload'a taşınmıyor |
| Varsayılan Hello World controller/test | Artık proje davranışı değil | E2E kapsamını yanıltıyor |

Not: `BeaconTestPage` bilinçli debug aracı olarak tutulabilir; sorun, gerçek attendance algoritmasıyla karıştırılma ve üretim davranışını temsil etmeme riskidir.

---

## Slayt 12 — V3 dışındaki, server testini etkileyen önemli bulgular

- Hall-beacon ataması, salonun kongresi ile beacon'ın kongresinin aynı olduğunu doğrulamıyor. Cross-congress eşleme yapılabilir.
- `ObservationBatch.clientBatchId` idempotency anahtarı olarak saklanıyor fakat unique değil ve karar akışında kullanılmıyor.
- Observation ingestion beacon başına ayrı sorgu yapıyor; büyük batch'te N+1 sorgu oluşur.
- Observation ve batch için maksimum boyut/zaman penceresi yok.
- `AttendanceQueryService.getVisitTrace()` kongre scope almıyor; panel kongre değiştirince eski seçili visit ID ile başka kongrenin trace'i gösterilebilir.
- `DecisionTracePanel`, kongre değişiminde `selectedId` state'ini sıfırlamıyor; yukarıdaki backend davranışını tetikleyebilir.
- Kongre gün başlangıcı ve oturum zamanları server timezone'una bağlı; kongre timezone modeli yok.
- Session create/update, hall'ın aynı kongreye ait olduğunu ve `startTime < endTime` olduğunu doğrulamıyor.

---

## Slayt 13 — Çalışma ağacı ve deploy riski

İnceleme anında ürün kaynaklarında henüz commit edilmemiş iki web değişikliği vardı:

- Decision Trace panelinde grace ile donmuş beacon'ı “elendi” yerine “donmuş · grace” gösterme düzeltmesi.
- Web `DecisionTrace` tipine `stale?: boolean` alanı eklenmesi.

Bunlar algoritmayı değiştirmiyor; ancak debug ekranının yanlış yorumlanmasını engelliyor. Sunucuya yalnızca commit edilmiş V3 sürümü yüklenirse bu UI netliği de gitmez.

Ayrıca güncel `algoritma-v3-referans-rehberi.md` ve saha veri dosyası Git'te izlenmiyor. Referans rehberi deploy için zorunlu değil ama ekip bilgisinin kaybolmaması açısından commit/PR kapsamı netleştirilmeli.

---

## Slayt 14 — Servera yükleme kararı

### Production / gerçek katılım verisi

**Onay yok.** P0-1, P0-2 ve P0-3 çözülmeden gerçek katılım üretmek veri kaybı ve yanlış attendance riski taşır.

### İzole staging / gözlemsel test

Koşullu olarak yapılabilir, fakat aşağıdakiler açıkça kabul edilmelidir:

- Test kongresi ve test kullanıcıları kullanılmalı.
- Android yerine izinleri doğrulanmış iOS cihaz tercih edilmeli veya Android manifest problemi önce çözülmeli.
- Test beacon UUID'si sabit UUID ile eşleşmiyorsa mobil test başlamaz.
- Sonuçlar gerçek attendance kaydı olarak kullanılmamalı.
- Her test sonunda raw observation, decision trace, visit/event ve Redis davranışı birlikte incelenmeli.

---

## Slayt 15 — Onaydan önce minimum düzeltme listesi

### Zorunlu (P0)

1. Mobil taramayı login/bootstrap'tan gelen gerçek kongre UUID'siyle başlatmak.
2. Android release için internet, Bluetooth ve gereken konum izinlerini; release identity/signing ayarlarını tamamlamak.
3. Observation kaydı ile attendance işleme arasına güvenilir transaction/outbox/reprocess mekanizması koymak.
4. Offline snapshot kuyruğunu kalıcı depolamaya almak ve batch sınırı/backoff eklemek.

### Yüksek öncelik (P1)

5. Kullanıcı bazlı sıralı işleme veya concurrency koruması eklemek; eski/future `observedAt` sınırlarını belirlemek.
6. Stale sweep'i koşullu update ile yarışa dayanıklı yapmak.
7. Ambiguity touch kontrolünü “passing candidates” kümesiyle aynı mantığa bağlamak.
8. `staleGraceSeconds` varsayımını mobil duty cycle ile uyumlu hale getirmek ve gerçek cihazla ölçmek.
9. Type-check fixture hatasını ve E2E Jest mapper sorununu düzeltmek; gerçek observation→visit→dashboard E2E senaryosu eklemek.

### Bakım/şeffaflık (P2)

10. Üç V3 dokümanının durum etiketlerini ve zaman varsayımlarını güncellemek.
11. `HallBeacon.rssiThreshold` alanını ya gerçek bir işlevle bağlamak ya kaldırmak.
12. Outlier ve sentinel metriklerini ayrı tutmak.
13. Trace/event ilişkisinde güvenilir foreign key veya doğrudan referans düşünmek.
14. Kullanılmayan debug/prototip kodunu açıkça debug-only olarak ayırmak.

---

## Slayt 16 — Kapsamlı test planı (düzeltmelerden sonra)

### Otomatik testler

1. Saf matematik: Hampel, MAD=0, EMA, softmax, eşitlik, sıcaklık sınırları.
2. Transition: giriş, çıkış, alternatif salon, passing/non-passing ambiguity örneği, stale touch.
3. Ingestion: duplicate retry sonrası processor'ın kaçmaması, duplicate beacon input, zaman sınırları.
4. DB/Redis E2E: paralel batch, out-of-order batch, stale sweep yarış senaryosu.
5. API contract: OpenAPI ile endpoint/response doğrulaması.
6. Mobil test: bootstrap UUID, persisted queue, boş scan, retry, 401, interval değişimi.

### Gerçek cihaz/saha testi

1. Tek salon/tek beacon ile veri hattı.
2. İki bitişik oda: ortalar, eşik, koridor, normal yürüyüş.
3. Üç salon: softmax adaylarının trace'te görünmesi.
4. Sentinel ve kısa signal-loss: grace mekanizmasının gerçekten rakip salona sahte geçişi engellemesi.
5. Foreground/background, ağ kesintisi, uygulama yeniden başlatma ve saat sapması.
6. Manuel zaman kaydı ile `HallVisit.startedAt`, `lastConfirmedAt`, `endedAt` karşılaştırması.

---

## Son slayt — Nihai değerlendirme

V3, önceki V2'ye göre belirgin bir teknik ilerleme: kararın merkezi hâle gelmesi, sinyal filtreleme, yumuşatma, göreli skor, trace ve konfigürasyon yaklaşımı sağlam.

Fakat gerçek sistem kalitesi yalnızca algoritma fonksiyonlarının doğru olmasıyla ölçülmez. Mobilin doğru beacon'ı taraması, snapshot'ın kaybolmadan işlenmesi, zaman sırasının korunması ve gerçek cihaz testleri aynı derecede önemlidir.

**Bugünkü sonuç:** Çekirdek V3 algoritmasını kavramsal olarak onaylıyorum; mevcut uygulamayı production/server onayı için henüz onaylamıyorum. Önce bu rapordaki P0/P1 maddeleri kapatılmalı, sonra kontrollü saha testi yapılmalıdır.
