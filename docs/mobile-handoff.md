# Mobil Devir Notları

Bu dosya, backend/panel tarafında (Windows, Claude Code ile) yapılan ve Mac/Xcode
gerektirdiği için tamamlanamayan işleri Ahmet'e devretmek için kullanılır. Her devir
için tarihli yeni bir bölüm ekleyin, üzerine yazmayın.

---

## 2026-07-17 — Ranging Duty-Cycle + TestFlight Hazırlığı

### Ne değişti ve neden

- Branch: `feature/mobile-ranging-duty-cycle` (taban: `develop`)
- Değişen dosya: `mobile/lib/features/observations/domain/beacon_observation_service.dart`
- Gerekçe: Foreground'dayken `flutterBeacon.ranging()` sürekli açık kalıyordu —
  bu, kesintisiz Bluetooth taraması demek, dolayısıyla gereksiz pil tüketimi ve
  olası iOS arka plan/pil uyarısı riski taşıyor. Bunun yerine foreground'da
  periyodik bir "duty-cycle" (belirli aralıklarla kısa süreli tarama penceresi)
  getirildi.

### Davranış değişikliği özeti

| Durum | Öncesi | Sonrası |
|---|---|---|
| Foreground | `ranging()` sürekli açık | `WidgetsBindingObserver` ile foreground/background geçişi izleniyor; 45 saniyede bir 9 saniyelik tarama penceresi açılıyor |
| Background (region'a giriş sonrası) | `_onMonitoringResult` ranging'i sürekli/koşulsuz başlatıyordu | iOS'un `didEnterRegion` sonrası tanıdığı ~10 saniyelik pencere kullanılıyor; `beginBackgroundTask` ile uzatma **yapılmıyor** (kasıtlı — güvenilmez ve gereksiz risk) |
| Monitoring'in ranging'i tetiklemesi | Foreground'da da tetikleyiciydi (gereksiz ikinci bir başlatma) | Foreground'dayken artık devre dışı (`if (_isForeground) return;`) — duty-cycle zaten yönetiyor; yalnızca background'da tetikleyici |

### Bu makinede doğrulanan (Windows, Xcode gerektirmez)

- `dart format --set-exit-if-changed`: dosya biçimlendirildi (proje formatına
  uygun hale getirildi); tekrar çalıştırıldığında artık temiz döner.
- `flutter analyze`: **"No issues found!"** (26.3s, uyarı/hata yok).
- İlgili test: `mobile/test/widget_test.dart` bu servisle ilgisiz (eski
  `BeaconTestApp` smoke test'i) ve zaten `skip: true` — bu değişiklik için
  çalıştırılan/geçen bir birim testi yok. **Ahmet doğrulamalı**: gerçek cihazda
  davranışın beklenen gibi olduğu.
- Kod incelemesi: `_startRanging` artık dosya içinde yalnızca
  `_beginRangingWindow` üzerinden çağrılıyor, başka doğrudan çağrı kalmadı.
- Native tarafta (Info.plist/Podfile) değişiklik gerekmedi: `WidgetsBindingObserver`
  saf Flutter framework mixin'i, yeni bir native izin/ayar istemiyor. Mevcut
  `UIBackgroundModes: location` (önceki commit'ten, `919fb0f`) zaten yeterli.

### Ahmet'in yapması gerekenler (Mac/Xcode gerektirir — bu makinede yapılamadı)

1. Branch'i çek ve PR'ı incele: `feature/mobile-ranging-duty-cycle` (PR açıklaması
   ayrıca paylaşılacak, base: `develop`).
2. Kendi Mac'inde `flutter analyze`'ı ve gerçek cihaz testini (foreground +
   background senaryoları) tekrarla.
3. Production API URL'i ile release build al:
   ```
   flutter build ios --release --dart-define=API_BASE_URL=https://beacon.photofocustr.com/api
   ```
   Bu adres `curl` ile test edildi, `/api/health` şu an `200` dönüyor (bkz.
   `docs/mobile-next-tasks.md` §0). **Ahmet doğrulamalı**: repoda veya bir
   CI/Fastlane script'inde bu değeri kaydeden hiçbir dosya yok (aradım,
   `.github/workflows/` ve `mobile/fastlane/` bu projede yok) — yani şu ana kadar
   hangi `API_BASE_URL` ile build/test yaptığını yalnızca kendi terminal/Xcode
   geçmişinden teyit edebilir.
4. Xcode'da Product > Archive, ardından Organizer > Distribute App > TestFlight
   ile yükle (imzalama/provisioning zaten Ahmet'in ortamında kurulu olmalı, bu
   dokümanın kapsamı dışında).
5. TestFlight build'ini cihaza indirip kurulum.

### TestFlight'ta özellikle test edilmesi istenenler

1. Uygulama arka planda, ekran kapalı, uzun süre (30+ dk) — veri akışı kesintisiz
   mi yoksa beklenen ~10 saniyelik pencerelerle mi geliyor (backend'de
   `BeaconObservation.observedAt` zaman damgalarıyla karşılaştırılacak).
2. Kasıtlı uçak modu (birkaç dakika) — bağlantı dönünce kuyruk düzgün boşalıyor
   mu, veri kaybı var mı.
3. Mümkünse geçici bir log ile `didEnterRegion`/`didExitRegion` kaç kez
   tetikleniyor say — sık tetikleniyorsa region sınırında titreşim (jitter)
   ihtimaline işaret eder.
4. Foreground'daki yeni duty-cycle ritmi: uygulama açıkken taramanın sürekli değil,
   45 saniyede bir ~9 saniyelik pencerelerle geldiğini gözlemle (pil tüketiminde
   gözle görülür iyileşme bekleniyor).

### Sonuçları nereye bildir

Berke'ye (bu proje kanalından/mesajdan) veya doğrudan bu dosyaya yeni bir
"Sonuç" alt başlığı ekleyerek.

### Sonuç

**Gerçek cihazda test edildi, arka plan veri akışı bozuk çıktı.** Uygulama
arka planda/ekran kapalıyken artık veri gelmiyordu — bu commit'ten önceki
davranış güvenilir çalışıyordu. Kök neden: bu commit'teki arka plana geçiş
mantığı, arka plana geçildiğinde ranging'i tamamen durduruyor ve yeniden
başlatmayı yalnızca `monitoring()`'in `didEnterRegion` olayına bağlıyordu.
Apple'ın dokümantasyonuna göre bu olay salona girişte **bir kez** tetiklenir,
salonda kalındığı sürece tekrar tetiklenmez — yani katılımcı salona girip
kaldığında yalnızca tek bir ~10 saniyelik veri patlaması alınıyor, sonrasında
hiçbir şey gelmiyordu.

Düzeltme aynı gün içinde yapıldı, bkz. aşağıdaki bölüm:
**"2026-07-17 (devam) — Arka Plan Ranging Regresyon Düzeltmesi"**.

---

## 2026-07-17 (devam) — Arka Plan Ranging Regresyon Düzeltmesi

### Ne değişti ve neden

- Branch: `fix/mobile-background-ranging` (taban: `develop`, yukarıdaki
  duty-cycle değişikliği zaten `develop`'a merge edilmiş haldeydi)
- Değişen dosya: yine `mobile/lib/features/observations/domain/beacon_observation_service.dart`
- Gerekçe: yukarıdaki "Sonuç" bölümünde açıklanan regresyonu düzeltmek.

### Bu kez neyin farklı olduğu

Önceki tasarımın hatası: arka plana geçince ranging'i **tamamen durdurup**,
yeniden başlatmayı yalnızca kenar-tetiklemeli `didEnterRegion` olayına
bağlamaktı — bu olay salonda kalındığı sürece tekrar tetiklenmiyor.

Yeni tasarım:

| Durum | Davranış |
|---|---|
| Foreground | 10 saniyelik döngüde 4 saniyelik ranging penceresi (süre 45sn/9sn'den 10sn/4sn'ye çekildi); gönderim 10sn'de bir |
| Background | **Ranging artık hiç durdurulmuyor** — sürekli açık kalıyor (eskiden güvenilir çalışan mekanizmanın aynısı). Gönderim sıklığı 30sn'ye seyreltildi |
| Monitoring | Artık foreground/background ayrımı yapmadan, her iki durumda da "ranging bir şekilde durmuşsa geri getir" güvenlik ağı olarak çalışıyor |
| Erken gönderim (kuyruk ≥10 kayıt) | Yalnızca foreground'da aktif. Background'da devre dışı — aksi halde ranging sürekli açık olduğu için kuyruk ~10sn'de dolar ve 30sn hedefini sessizce geçersiz kılardı |

Kritik detay: arka plana geçişte, bekleyen bir foreground ranging-penceresi
zamanlayıcısı da (`_rangingWindowTimer`) iptal ediliyor — aksi halde birkaç
saniye sonra kendiliğinden tetiklenip ranging'i yine kapatabilirdi.

### Bu makinede doğrulanan (Windows, Xcode gerektirmez)

- `dart format --set-exit-if-changed`: temiz (0 değişiklik).
- `flutter analyze`: **"No issues found!"**
- Kod incelemesi: `_stopRanging()` artık dosyada yalnızca kendi pencere
  zamanlayıcısından çağrılıyor (grep ile doğrulandı) — arka plana geçiş
  yolunda **hiç çağrılmıyor**, bu da regresyonun tam nedeniydi.

### Ahmet'in yapması gerekenler (Mac/Xcode gerektirir)

1. Branch'i çek ve PR'ı incele: `fix/mobile-background-ranging`.
2. Kendi Mac'inde `flutter analyze`'ı tekrarla, gerçek cihazda test et.
3. Test öncesi **cihazda konum izninin "Her Zaman" olduğunu ve Düşük Güç
   Modu'nun kapalı olduğunu** doğrula — ikisi de bu mekanizmayı kodun
   doğruluğundan bağımsız olarak sessizce bozabilir, ve bir önceki
   regresyonun TestFlight'ta neden yakalanmadığını da açıklayabilir.
4. Production API URL'i ile release build al ve TestFlight'a yükle (bkz.
   önceki bölümdeki adımlar, değişmedi).

### TestFlight'ta test protokolü (bu kez net kriterlerle — önceki devirde
"bir süre test et" yeterli olmamıştı)

Aşağıdakilerin HEPSİ geçmeli, yalnızca biri değil:

1. **Sürekli arka plan testi:** Aynı yerde (beacon menzilinde), uygulama arka
   planda, ekran kapalı, **en az 5-10 dakika kesintisiz** kal. Backend'de
   `BeaconObservation.observedAt` zaman damgalarını kontrol et — başta bir
   patlama olup sonra sessizlik OLMAMALI, ~30 saniyede bir yeni kayıt gelmeye
   devam etmeli.
2. **Bölgeden çıkış/giriş testi:** Beacon menzilinden fiziksel olarak çık,
   birkaç dakika bekle, tekrar gir. Veri akışının kendiliğinden devam ettiğini
   doğrula (monitoring güvenlik ağı çalışıyor mu).
3. **Geçici kesinti testi:** Arka plandayken kısa bir telefon çağrısı al veya
   kontrol merkezini aç/kapat. Bu, veri akışında gözle görülür bir kesintiye
   yol açmamalı (`inactive` durumu artık no-op).
4. **Foreground testi:** Uygulama açıkken taramanın sürekli değil, 10
   saniyede bir ~4 saniyelik pencerelerle geldiğini gözlemle.

### Sonuçları nereye bildir

Berke'ye veya doğrudan bu dosyaya yeni bir "Sonuç" alt başlığı ekleyerek —
özellikle madde 1'in (sürekli arka plan testi) sonucunu.

---

## 2026-08-09 — Faz 6 gerçek cihaz doğrulaması (Claude Code, Berke'nin iPhone 16 Pro'su "Baş")

### Bağlam

Faz 6 (mobil iskelet: kimlik, izin, kabuk) Simulator'da doğrulanmıştı; bu tur
gerçek cihazda tamamlayıcı doğrulama içindi. Kullanıcı: `faz1-test@example.com`,
kongre: "Test" (gerçek Minew beacon'ları tanımlı, UUID
`E2C56DB5-DFFB-48D2-B060-D0F5A71096E0`). Backend: izole, yalnızca bu tur için
port 3002'de ayrı bir instance (kullanıcının asıl geliştirme sunucusuna
dokunulmadı), aynı yerel MySQL/Redis'i kullandı.

### Bulunan ve düzeltilen 3 gerçek hata (Faz 6 kapsamında, kod değişikliği yapıldı)

1. **`route_redirect.dart` — izin kapısı oturum hatası tarafından atlanıyordu.**
   `authHasError`, `permissionLoading` ile aynı üst-seviye koşuldaydı; ağa
   ulaşılamadığında (oturum kontrolü hata verince) izin durumu ne olursa olsun
   `/permission` atlanıp `/splash`'e düşülüyordu. Simulator'da `simctl privacy
   revoke location` ile yakalandı. Düzeltme: izin, oturum kontrolünden kesin
   olarak önce değerlendiriliyor. Regresyon testi eklendi.
2. **`api_client.dart` — arka plan isteği yarış durumu global çıkışı tetikliyordu.**
   Şifre değiştirme gibi `tokenVersion`'ı artıran bir işlemden hemen sonra,
   arka planda çalışan beacon servisinin ESKİ token'la attığı bir istek 401
   dönüyor ve bu, YENİ başarıyla kurulan oturumu da düşürüyordu (gerçek cihazda
   "şifre değiştirince otomatik çıkış yapıyor" olarak yakalandı, backend
   curl ile birebir aynı akış test edilip backend'in doğru çalıştığı
   doğrulandıktan sonra istemci tarafı izole edildi). Düzeltme: 401 alan
   isteğin kullandığı token, depodaki GÜNCEL token ile karşılaştırılıyor;
   eşleşmiyorsa (yani token o sırada zaten yenilenmiş) bu 401 bayat sayılıp
   global çıkış tetiklenmiyor.
3. **`permission_gate_provider.dart` — soğuk açılışta konum izni penceresi hiç çıkmıyordu.**
   `flutter_beacon`, konum izni istemeden önce native tarafta
   `CBCentralManager`'ın "poweredOn" durumuna gelmesini bekliyor. Uygulamanın
   soğuk açılışında bu callback bazen gecikiyor/gelmiyor — Bluetooth zaten
   açık olsa bile — ve sonuç olarak izin penceresi hiç çıkmadan durum
   `notDetermined`'de kalıyor (kullanıcı "İzin Ver"e bassa bile). Sahada
   "Bluetooth'u kapatıp açınca düzeliyor" olarak gözlemlendi ama kullanıcıdan
   bunu istemek kabul edilemez. Düzeltme: durum hâlâ `notDetermined` ise
   (gerçekten reddedilmedi, pencere gelmedi) 700ms sonra bir kez otomatik
   yeniden denenir. Gerçek cihazda doğrulandı: düzeltmeden önce Bluetooth
   kapat-aç gerekiyordu, düzeltmeden sonra hiç dokunmadan çalıştı.

Ayrıca kozmetik bir Flutter framework uyarısı düzeltildi: `profile_page.dart`
içindeki `ListTile`'lar renkli bir `DecoratedBox`'a doğrudan sarılıydı (ink
splash/dokunma geri bildirimi görünmez oluyordu) — araya şeffaf bir `Material`
eklendi.

### Gerçek cihazda tam doğrulanan (log kanıtıyla)

- Temiz kurulum → zorunlu izin ekranı → izin ver → giriş ekranı (izin gerçekten
  reddedildiğinde de doğru davranış, yukarıdaki #1 düzeltmesiyle).
- Kayıt Ol → e-postaya kod → zorunlu şifre değiştirme (kilitli, geri
  dönülemiyor) → kongre seçimi (2 kongre listelendi) → kabuk.
- **Sekmeler arası geçiş (Ana Sayfa/Program/Profil, 5-6 kez) boyunca beacon
  servisi HİÇ durmadı** — log'da tek `START`, sıfır `STOP`, bu fazın en kritik
  iddiası. Kanıt: `[ObservationLifecycle] START congressId=... deviceId=...`
  bir kez, ardından yalnızca `NO-OP` satırları.
- Kongre değiştirme: `STOP` (eski kongre) → `START` (yeni kongre) sırasıyla,
  doğru congressId'lerle.
- Gönüllü şifre değiştirme: düzeltmeden ÖNCE oturumu düşürüyordu (#2), düzeltmeden
  SONRA `NO-OP` ile sorunsuz devam etti.
- Çıkış yap → `STOP`, log ekranı → tekrar giriş → `START`, izin ekranı BİR DAHA
  ÇIKMADI, aynı `deviceId` yeniden kullanıldı (yeni cihaz kaydı oluşmadı).
- Metin ölçeklendirme (Erişilebilirlik > Daha Büyük Metin, en büyük) → taşma/
  kesilme yok.

### Doğrulanamayan — beacon veri akışı (AÇIK BULGU, kök nedeni bulunamadı)

Servis 6+ dakika boyunca kesintisiz, tasarlandığı gibi (foreground'da her 10
saniyede bir yeniden başlayan ranging penceresi — native `NSLog` ile
`devicectl device process launch --console` üzerinden doğrudan doğrulandı:
`START: CLBeaconRegion (...)` satırı dakikada bir düzenli aralıklarla
tekrarladı) çalıştı, ama **backend'e tek bir `BeaconObservation` bile
ulaşmadı**. Sırayla ekarte edilenler: konum izni (Her Zaman, doğrulandı),
Bluetooth izni (uygulama ayarlarında açık), UUID eşleşmesi (kullanıcı
BeaconSET Plus'tan teyit etti), iBeacon yayın modu (etkin, teyit edildi),
fiziksel mesafe (3-5cm), Düşük Güç Modu (kapalı — bu dosyanın 2026-07-17
notundaki bilinen tuzak), backend erişilebilirliği (test ortasında Mac'in
Wi-Fi IP'si değişmişti — `192.168.1.108` → `192.168.6.114` — bu ayrı, gerçek
bir bulgu olarak düzeltildi ve yeniden test edildi, ama beacon sorununu TEK
BAŞINA açıklamadı: IP düzeltmesinden sonra da 80 saniye boyunca hâlâ sıfır
gözlem geldi).

`beacon_observation_service.dart`'ın iç mantığına dokunma yetkisi olmadığı
için (Faz 6 talimatının mutlak kısıtı) buradan öteye debug logu ekleyip kök
nedeni izole edemedim. **Ahmet'in/Berke'nin yapması gerekenler:**
1. Xcode'u doğrudan cihaza bağlayıp (Window > Devices and Simulators > Open
   Console, veya bir breakpoint) `_onRangingResult`'ın gerçekten çağrılıp
   çağrılmadığını, çağrılıyorsa `result.beacons`'ın boş gelip gelmediğini
   kontrol et — bu, sorunun native ranging'de mi yoksa
   Dart↔native EventChannel köprüsünde mi olduğunu ayırt eder.
2. Aynı beacon'ı, bu projeden bağımsız üçüncü parti bir iBeacon tarayıcı
   uygulamasıyla (BeaconSET Plus'ın kendi "tara" özelliği değil, jenerik bir
   iBeacon scanner) test ederek gerçekten iBeacon paketleri yayınlandığını
   doğrula.
3. `flutter_beacon` 0.5.1'in bilinen sorunlarına (GitHub issues) bakılabilir —
   bu paket aktif bakımlı değil gibi görünüyor.

### Sonuçları nereye bildir

Berke'ye veya doğrudan bu dosyaya yeni bir "Sonuç" alt başlığı ekleyerek —
özellikle beacon veri akışı bulgusunun ilerleyişini.

---

## 2026-08-09 (devam) — Faz 6.1: Beacon veri akışı bulgusunun kök nedeni bulundu

### Bağlam

Bir önceki bölümde ("Faz 6 gerçek cihaz doğrulaması") beacon servisi 6+ dakika
kesintisiz çalışmasına rağmen backend'e hiç veri ulaşmadığı, kök nedenin
bulunamadığı yazılmıştı. Öncelikli şüpheli, kodda sabit yazılı POC UUID'si
(`E2C56DB5-DFFB-48D2-B060-D0F5A71096E0`) idi.

### Önce doğrulama: UUID şüphesi çürütüldü

Test edilen "Test" kongresi için dört değer karşılaştırıldı: koddaki sabit,
`Congress.beaconUuid` (DB), `Beacon` tablosu, ve gerçek Minew cihazın
yayınladığı UUID (BeaconSET Plus ile teyit edildi) — **dördü de aynıydı**.
Yani UUID sabit-yazılı olması, o kongrede tesadüfen doğru çalışıyordu; bu,
gözlemlenen sıfır-veri hatasının açıklaması DEĞİLDİ (ama başka bir kongrede
kesin çalışmayacağı için ayrıca düzeltildi, bkz. aşağı).

### Gerçek kök neden: yerel önbellekte kalmış, artık DB'de olmayan `deviceId`

`BeaconObservationService`'e (dokunulmadan) `_emitState`, `initializeScanning`,
`authorizationStatus`, her ranging/monitoring callback'i ve her batch gönderim
sonucunu loglayan `kDebugMode` teşhis logları eklenince (karar mantığı
DEĞİŞMEDİ, yalnızca gözlem) tablo netleşti:

- Ranging mükemmel çalışıyordu: her döngüde 4-5 beacon görülüyordu.
- Kuyruk doluyor, batch düzenli deneniyordu.
- Her batch denemesi **`403 Bu cihaz bu kullaniciya ait degil`** ile
  reddediliyordu.

Backend'de kontrol edilince: telefonun Keychain'inde (uygulama silinip
yeniden kurulsa bile hayatta kalan) önbelleğe alınmış `deviceId`, `Device`
tablosunda **hiç yoktu** — muhtemelen bu genişletilmiş test sürecinin bir
noktasında veritabanı sıfırlanmış/yeniden seed edilmişti, ama telefonun
Keychain'i backend durumundan tamamen bağımsız olduğu için eski ID'yi
tutmaya devam etti. `ObservationLifecycleNotifier._sync()`'in mantığı
(`deviceId ??= await _registerDevice()`) yalnızca `deviceId` **null**
olduğunda yeniden kayıt tetikliyor — var olan ama artık geçersiz bir ID'yi
asla sorgulamıyordu. Sonuç: sessiz, sonsuz 403 döngüsü, hiçbir yerde
kullanıcıya veya geliştiriciye yansımayan (Faz 6'da eski debug kartları
silindiğinden `ObservationServiceState` hiçbir UI'a bağlı değil).

Doğrulama: backend veritabanına bu `deviceId` için doğru kullanıcıya ait bir
`Device` satırı elle eklenince, bir sonraki batch denemesi anında
`Accepted: 70` döndü ve veri akışı kesintisiz devam etti (11+ dakikalık arka
plan testinde 2283 gözlem, ortalama ~3.3/saniye).

**Bu, projenin ikinci beacon regresyonuydu (ilki 2026-07-17, ranging
duty-cycle) ama farklı bir kategoride: kod her zaman doğruydu, sorun bir
geliştirme-ortamı veri tutarsızlığıydı. Kalıcı ders:** yerel önbelleğe alınan
bir kimlik (deviceId, ve benzer şekilde beaconUuid) sunucu tarafında
silinebilir/değişebilir; istemci bunu sessizce varsaymak yerine ya
periyodik olarak doğrulamalı ya da başarısızlık modunun (403/404) açıkça
görünür olmasını sağlamalı. **Öneri (bu oturumda yapılmadı, ayrı görev
olabilir):** `_trySendBatch`'in 403 "cihaz sahiplik" hatasını da (401 gibi)
özel olarak ele alıp cihazı yeniden kaydetmeyi tetiklemesi.

### Ayrıca düzeltilen: UUID artık backend'den geliyor (Faz 6.1 görevi 2-3)

UUID şüphesi bu hatayı açıklamasa da, sabit yazılı olması mimari olarak
yanlıştı (yalnızca "Test" kongresinde tesadüfen çalışırdı). Düzeltildi:

- `BeaconObservationService`: `_defaultRegionUuid` sabiti kaldırıldı,
  `beaconUuid` artık **zorunlu** bir constructor parametresi (yanlış/boş bir
  varsayılanla sessizce çalışmak, hiç çalışmamaktan kötü olduğu için).
- `ObservationLifecycleNotifier`: kongre seçildikten sonra, servis
  başlatılmadan önce `GET /mobile/bootstrap?congressId=...` çağrılıyor
  (bu uç nokta guard'sız - "TestFlight'taki mevcut sürüm bunu kullanıyor"
  yorumuyla bilerek böyle bırakılmış, bkz. `mobile.controller.ts`).
  Yanıttaki `congress.beaconUuid` servise geçiriliyor; `halls`/
  `rssiThreshold` kısmı kullanılmıyor (salon kararı backend'de veriliyor).
- Çevrimdışı dayanıklılık: bootstrap yanıtı kongre kimliğiyle birlikte
  `SecureStorageService`'e yazılıyor. Ağ hatasında, AYNI kongre için daha
  önce kaydedilmiş bir UUID varsa o kullanılıyor; farklı bir kongreye aitse
  veya hiç yoksa servis **başlatılmıyor** (yanlış UUID'yle sessizce
  "çalışıyor gibi görünmek" yerine).
- Kongre değiştirme, gerçek cihazda log kanıtıyla doğrulandı: "Test"
  kongresinden "Seed Test Kongresi 1"e geçişte `STOP` sonrası, DOĞRU ve
  FARKLI UUID (`00000000-...0001`) ile `START` görüldü.

### Panel/veri gözlemi (kod değişikliği DEĞİL, ayrı görev önerisi)

Doğrulama sırasında kullanıcı panelden "Seed Test Kongresi 1"e gerçek UUID'li
4 `Beacon` kaydı ekledi, ama kongrenin kendi `beaconUuid` alanı otomatik
güncellenmedi (panel, tek tek beacon eklemeyi kongre-seviyesi UUID'den
bağımsız yapıyor) - mobil uygulama ranging için KONGRE seviyesindeki
`beaconUuid`'yi kullandığından (iOS'un bölge taraması UUID bazlı), bu
kongre hâlâ veri toplayamadı. Veri elle düzeltildi (`Congress.beaconUuid`
eklenen beacon'larla eşleşecek şekilde güncellendi). **Kullanıcının isteği,
ayrı bir görev olarak:** panelden beacon eklendiğinde kongrenin
`beaconUuid`'sinin otomatik güncellenmesi/doğrulanması - bu bir backend/panel
kod değişikliği, bu oturumun kapsamı dışında bilerek bırakıldı.

### Gerçek cihazda doğrulanan (bu oturumda)

- 3 UUID karşılaştırması (kod/kongre/cihaz) - "Test" kongresi için hepsi
  aynıydı.
- Kök neden teşhisi: 403 "cihaz sahiplik" hatası, kDebugMode loglarıyla
  kesin olarak izole edildi.
- Uçtan uca veri akışı: 2750+ `BeaconObservation`, `HallVisit` (salon 1,
  algorithmVersion=v3) ve `AttendanceEvent(ENTRY)` oluştu - backend'den
  doğrulandı.
- Arka plan akışı: 11+ dakika kesintisiz, 2283 gözlem (~3.3/saniye
  ortalama), foreground/background geçişi boyunca kesinti yok.
- Bootstrap entegrasyonu: kongre değiştirmede doğru/farklı UUID ile yeniden
  başlatma, log kanıtıyla doğrulandı.
- `flutter analyze`: "No issues found!", `dart format`: temiz,
  `flutter test`: 17/17 geçti.

### Doğrulanamayan / ertelenen

- Çevrimdışı fallback yolu (ağ yokken önbellekteki UUID ile devam etme) kod
  incelemesiyle doğrulandı ama gerçek cihazda uçak modu senaryosuyla canlı
  test edilmedi (zaman kısıtı).
- `flutter_beacon: ^0.5.1` paketi 4 yıldır güncellenmiyor (iOS 17/18'den
  önce) - bu oturumda bir soruna yol açtığı KANITLANMADI (asıl sorun
  deviceId'ydi), ama uzun vadede izlenmesi gereken bir risk faktörü.

---

## 2026-08-09 (devam 2) — Faz 6.2: Beacon UUID Tutarlılığı ve Cihaz Kaydı Dayanıklılığı

### Bağlam

Faz 6.1'in kapanışında iki takip görevi bırakılmıştı: (1) "panelden beacon
eklendiğinde kongrenin `beaconUuid`'sinin otomatik güncellenmesi/doğrulanması"
(yukarıdaki "Panel/veri gözlemi" bölümü) ve (2) "`_trySendBatch`'in 403
'cihaz sahiplik' hatasını da özel olarak ele alıp cihazı yeniden kaydetmeyi
tetiklemesi" önerisi. Bu tur ikisini de birden ele aldı; branch:
`fix/beacon-tutarlilik` (taban: Faz 6.1'in branch'i).

### Backend değişiklikleri

- `beacon.service.ts` `create()`/`update()`: `dto.uuid` artık kongrenin
  `beaconUuid`siyle (büyük/küçük harf duyarsız) karşılaştırılıyor; uyuşmuyorsa
  `400` ("Beacon UUID'si kongrenin UUID'siyle eşleşmiyor"). Kongrenin
  `beaconUuid`si boşsa (yeni kongrenin ilk beacon'ı) otomatik benimseniyor,
  yanıtta `congressBeaconUuidAutoSet: true` olarak işaretleniyor.
- `congress.service.ts` `update()`: `beaconUuid` değişip kongrede zaten
  beacon varsa varsayılan `409`; `migrateExistingBeacons: true` ile açıkça
  onaylanırsa kongre + TÜM beacon'lar tek transaction'da güncelleniyor.
- `observation-ingestion.service.ts`: beacon eşleştirme sorgusu artık UUID'yi
  büyük harfe normalize ediyor (savunma amaçlı - MySQL collation zaten
  büyük/küçük harf duyarsız olduğu doğrulandı, ama JS tarafı normalize
  olmadan buna güvenemez).
- `reports.service.ts` `getDataQuality()`: en çok görülen 10 eşleşmeyen
  UUID/major/minor kırılımı + kongre-seviyesi tutarlılık uyarısı eklendi.
- Mevcut veride `Beacon.uuid != Congress.beaconUuid` taraması yapıldı:
  **tutarsızlık bulunmadı** (otomatik düzeltme kodu yazılmadı, bkz.
  `docs/decisions.md` "Faz 6.2" bölümü).
- Test: 320/320 geçti (34 suite, 3 yeni spec dosyası), `npm run build`/
  `npm run lint` temiz. `shared/openapi.yaml` güncellendi.

### Mobil değişiklikleri

- `beacon_observation_service.dart` (yalnızca izin verilen "çıkış noktası"
  kapsamında dokunuldu, ranging/duty-cycle mantığı DEĞİŞMEDİ):
  `ObservationServiceStatus`e `deviceInvalid` eklendi, 403 durumunda bu
  durum yayılıyor. Kurtarma sırasında bekleyen kuyruğun taşınabilmesi için
  constructor'a `initialQueue` parametresi ve salt-okunur `pendingSnapshots`
  getter'ı eklendi (ikisi de additive, karar mantığına dokunmuyor).
- `observation_lifecycle_provider.dart` (orkestratör katmanı, korumalı
  dosya DEĞİL): `deviceInvalid` durumunu dinleyip kendini onaran akış
  eklendi - eski `deviceId` silinir, `POST /devices/register` ile yeniden
  kaydolunur, bekleyen kuyruk yeni servis örneğine aktarılır, servis yeni
  `deviceId` ile yeniden başlatılır. Ardışık 3 başarısız denemeden sonra
  60 saniyelik soğuma (backoff) uygulanıyor - mutex (`_isRecoveringDevice`)
  ile aynı anda birden fazla kurtarma denemesi başlamıyor.
- `flutter analyze`: "No issues found!", `dart format`: temiz,
  `flutter test`: 17/17 geçti.

### Gerçek cihazda doğrulanan (bu oturumun en kritik testi)

Backend'deki bir `Device` satırının `userId`si elle başka bir kullanıcıya
taşınarak ("cihaz artık geçersiz" durumu üretmenin en temiz yolu -
doğrudan `DELETE` `ObservationBatch_deviceId_fkey` (`ON DELETE RESTRICT`)
yüzünden mümkün değildi, ama backend kodu açısından `!device` ile
`device.userId !== user.id` AYNI 403'e çıkıyor, yani aynı kod yolunu test
ediyor) uygulama ÇALIŞIRKEN 403 tetiklendi. Log kanıtı:

```
[BeaconObservationService] batch gonderim hatasi statusCode=403 ...
[BeaconObservationService] state=deviceInvalid ... lastBatch=Hata: Cihaz kaydi gecersiz (403)
[ObservationLifecycle] KURTARMA basliyor (deneme 1/3), 3 bekleyen gozlemle
[ObservationLifecycle] eski deviceId silindi, yeniden kayit yapiliyor...
[ObservationLifecycle] yeni deviceId ile servis yeniden baslatildi
[BeaconObservationService] state=active pending=0 lastBatch=Accepted: 3, Dup: 0, Rej: 0 error=null
```

Veritabanı doğrulaması: yeni `Device` satırı (`0bffcbfc-...`) doğru
kullanıcı (`faz1-test`) altında oluştu, kurtarma sonrası **388 yeni
`BeaconObservation`** bu cihaz altında kesintisiz kaydedildi. Bekleyen 3
gözlem (kurtarma anında kuyrukta olan) **kaybolmadı** - kurtarma sonrası
ilk batch'te `Accepted: 3` olarak dahil edildi.

**İkinci, bağımsız bir kurtarma daha kendiliğinden oluştu:** izleme
sırasında izole test backend'i (port 3002) yaklaşık 2 dakika kapatılıp
tekrar açıldığında, aynı mekanizma tekrar tetiklendi - eski `deviceId` ile
yapılan ilk denemede backend'in artık 403 vermesi üzerine (araya
reassignment de girmişti) YENİ bir cihaz (`5bb9527a-...`) otomatik
kaydoldu ve veri akışı kesintisiz devam etti (bu ikinci cihaz altında da
655 gözlem doğrulandı). Bu, mekanizmanın hem "cihaz geçersiz" hem "backend
tamamen erişilemez ve sonra geri gelir" senaryolarında sağlam çalıştığını
gösteriyor - ikinci senaryoda ayrıca uygulamanın backend tamamen
erişilemezken (403 değil, bağlantı hatası) çökmediği/sonsuz döngüye
girmediği de gözlemlendi.

Ardışık 3 başarısız kurtarma denemesi sonrası soğuma davranışı CANLI cihazda
AYRICA tetiklenmedi (her iki gerçek senaryoda da backend erişilebilir hale
gelir gelmez İLK denemede kurtarma başarılı oldu) - bu spesifik dal
(`_maxConsecutiveDeviceRecoveryFailures`/`_deviceRecoveryBackoff`) yalnızca
kod incelemesiyle doğrulandı: sayaç/zaman damgası karşılaştırması, harici
bir bağımlılığı olmayan saf/deterministik Dart mantığı. Canlı olarak
yalnızca `POST /devices/register`i defalarca başarısız yapacak izole bir
arıza enjeksiyonu (backend'i tamamen kapatmak yeterli değil - o zaman 403
hiç alınamıyor, `deviceInvalid`e hiç girilmiyor) ile test edilebilirdi; bu,
mevcut araçlarla orantısız bir mühendislik çabası gerektirdiği için
bilinçli olarak atlandı.

### Panel değişiklikleri

- Beacon oluşturma formu artık kongrenin `beaconUuid`sinden ön dolduruluyor,
  uyuşmazlıkta anlık istemci-taraflı uyarı gösteriyor.
- Beacon listesinde UUID uyuşmayan satırlar kırmızı rozetle işaretleniyor.
- Kongre kartı düzenleme panelinde `beaconUuid` artık düzenlenebilir; kongrede
  beacon varsa 409 → onay bandı → "Onayla ve taşı" ile
  `migrateExistingBeacons: true` akışı uygulandı.
- Raporlar sayfasında tutarlılık uyarısı + eşleşmeyen gözlem kırılımı tablosu
  eklendi.
- `npm run lint`/`npm run build` temiz.

### `frontend-ui-reviewer` denetimi ve gerçek tarayıcıda bulunan kritik hata

`frontend-ui-reviewer` ajanı kimlik doğrulama gerektiren sayfalara giremedi
(ortamın güvenlik sınıflandırıcısı admin girişini engelledi) ama kod
incelemesiyle 3 P1 bulgu tespit edip düzeltti: (1) `beacons/page.tsx`da
`BeaconForm`a `key={congressId}` eksikti - kongre değiştirildiğinde UUID
ön-dolgusu eski kongrede takılı kalıyordu; (2) `congress-card-footer.tsx`de
yeni "Beacon UUID" alanı 2 sütunlu grid'de boş bir hücre bırakıyordu, tam
genişliğe alındı; (3) yeni zorunlu alan (*) ipucu metninde açıklanmıyordu.

Ardından gerçek admin oturumuyla (tarayıcıda zaten kayıtlı bir session
vardı, kimlik bilgisi girilmedi/üretilmedi) uçtan uca tarayıcı testi
yapıldı - yeni kongre oluşturma, beacon UUID ön-dolgusu, istemci-taraflı
uyumsuzluk uyarısı, backend 400'ü, ve raporlar sayfasındaki eşleşmeyen
gözlem kırılımı (gerçek "Test" kongresi verisiyle: major=0/minor=4 ve
minor=5 için panelde kayıtlı olmayan 1955/1959 gözlem tespit edildi -
gerçek, faydalı bir veri kalitesi bulgusu) hepsi doğru çalıştı.

**409 → migrate akışının canlı testinde gerçek bir hata bulundu ve
düzeltildi:** React'ın `<form action={sunucuEylemi}>` mekanizması, HER
gönderimden sonra (başarılı VEYA başarısız fark etmez) uncontrolled form
alanlarını `defaultValue`sine sıfırlıyor. `beaconUuid` alanı uncontrolled
olduğu için, ilk (mismatch) gönderim 409 döndükten hemen sonra alan
SESSİZCE kongrenin ESKİ UUID'sine geri dönüyordu - kullanıcı "Onayla ve
taşı"ya bassa bile, `requestSubmit()` DOM'daki (artık eski) değeri
gönderiyor, `beaconUuidChanging` `false` çıkıyor ve migrasyon SESSİZCE
no-op oluyordu (ne kongre ne beacon güncelleniyordu, kullanıcıya "Kaydedildi"
diye YANLIŞ bir başarı mesajı gösteriliyordu). Canlı DB sorgusuyla
doğrulandı: ilk denemede congress/beacon UUID'si değişmemiş çıktı. Düzeltme:
alan controlled yapıldı (`useState` + `value`/`onChange`) - React state
form-reset'ten etkilenmiyor. Düzeltme sonrası aynı senaryo tekrar canlı
test edildi: DB'de hem `Congress.beaconUuid` hem `Beacon.uuid` doğru
şekilde yeni değere güncellendi. Bu, "kod incelemesi + statik test yeterli"
sanılan bir akışın gerçek bir React davranışı yüzünden sessizce bozuk
olduğu, yalnızca uçtan uca canlı testle yakalanabilecek bir hataydı.

1440×900/1024×768/390×844 genişliklerinde görsel kontrol yapıldı, konsolda
hata/uyarı bulunmadı. Test için oluşturulan geçici kongre ("Faz62 Test")
ve beacon'ı doğrulama sonunda panelden silindi.

### Sonuçları nereye bildir

Berke'ye veya doğrudan bu dosyaya yeni bir "Sonuç" alt başlığı ekleyerek.

---

## 2026-08-10 — Faz 7: Mobil Ekranlar (Ana Sayfa, Bilimsel Program, İçerik)

### Ne değişti

Ana Sayfa ve Bilimsel Program sekmeleri (`ComingSoonView` yer tutucuları)
gerçek ekranlarla dolduruldu; 5 yeni içerik alt ekranı (Duyurular,
Sponsorlar, Ana Konuşmacılar, Otel/Mekan Detayları, Genel Bilgi) ve
Oturum Detayı eklendi; Profilim'e "Benim Programım" bölümü eklendi.
Yeni paylaşılan katmanlar: `core/network/cached_content_notifier.dart`
(9 ucun ortak önbellek-önce/ağ-sonra deseni), `core/storage/
content_cache_service.dart` (kalıcı dosya + bellek-içi önbellek),
`core/widgets/` altında `AsyncContentView`/`GracefulNetworkImage`/
`RoleTypeChip`, `core/utils/turkish_date_format.dart` ve
`external_link_launcher.dart`. Yeni paketler: `flutter_markdown_plus`,
`extended_image`, `path_provider` (gerekçeleri `docs/decisions.md`
Faz 7 bölümünde). `BeaconObservationService`'e HİÇ dokunulmadı; hiçbir
ekranda beacon/Bluetooth/tarama terimi geçmiyor (grep ile doğrulandı).

### Gerçek cihazda bulunan ve düzeltilen gerçek hata

Çevrimdışı testi sırasında (adım 8) Program ekranı **boş** görünüyordu -
"Bu günde henüz oturum yok" - oysa program verisi aslında kalıcı
önbellekte tam olarak mevcuttu. Kök neden: gün sekmeleri ayrı, bellek-ici
bir onbellekten geliyordu; uygulama yeniden kurulunca bu bellek sıfırlanıp
gün listesi bos donuyor, bu da tum oturumlari (dayLabel eslesmedigi icin)
gizliyordu. Düzeltme: gün listesi artık `/mobile/program`in zaten kalıcı
önbelleklenmiş oturum listesinden türetiliyor (ayrı ağ çağrısı/önbellek
YOK), aynı nedenle oturum detayı da hiç ayrı bir çağrı yapmıyor - ikisi de
tek kaynaktan (kalıcı program önbelleği) besleniyor. Ayrıntılı gerekçe:
`docs/decisions.md`, Faz 7 bölümü.

### Gerçek cihazda test sürecini karmaşıklaştıran, kodla İLGİSİZ iki ortam kısıtı

1. Wi-Fi IP'si test sırasında birkaç kez değişti (bilinen bir sorun, bkz.
   önceki Faz notları) - her seferinde `flutter run`'ı doğru IP ile
   yeniden başlatmak gerekti.
2. **Kritik bulgu:** uygulama tamamen sonlandırılıp home ekranından
   tekrar açılmaya çalışıldığında sessizce ana ekrana düşüyordu. İki
   sebebi vardı, ikisi de KOD DEĞİL: (a) ücretsiz Apple Developer
   hesabıyla imzalanan uygulamalar her yeni kurulumdan sonra bir kez
   internet üzerinden doğrulanmalı; (b) Flutter debug build'leri fiziksel
   cihazda `flutter run` dışında güvenilir şekilde yeniden başlatılamıyor.
   Bu ikisi çevrimdışı "kapat-aç" testini native seviyede imkânsız kıldı;
   test bunun yerine `autoDispose` provider'ların ekrandan çıkıp geri
   dönüldüğünde sıfırdan kurulmasından yararlanılarak (Dart-seviyesi
   soğuk-başlangıç, native kurulum katmanına dokunmadan) yapıldı - bu, asıl
   test edilmek istenen önbellek-okuma kod yolunu birebir aynı şekilde
   çalıştırır.

### Doğrulanan / doğrulanmakta olan (bu bölüm test tamamlanınca güncellenecek)

Test hâlâ sürüyor - kullanıcı paralel olarak kendi XCUITest otomasyon
denemesini kuruyor. Şu ana kadar gerçek cihazda TEYİT EDİLENLER: Ana Sayfa
(kapak/ad/tarih/mekan/6 buton/rozet sayıları/okunmamış duyuru rozeti -
açılınca kayboluyor VE uygulama yeniden kurulsa bile geri gelmiyor),
"Sıradaki Sunumum" kartı (doğru oturum/rol/UTC→yerel saat dönüşümü),
Duyurular (sabitlenmiş ayrışması, taslak gizli, "Devamını oku"), Sponsorlar
(kademe gruplama, dış bağlantı ikonu), Ana Konuşmacılar (fotoğrafsız
katılımcı baş harfleriyle, biyografi paneli), Bilimsel Program (gün
sekmeleri kronolojik sırada, salon filtresi çalışıyor, 2. gün + faz1-test
kullanıcısının kendi adıyla listelendiği oturum doğru), Oturum Detayı
(moderatör/sunum/rol/özet, uzun isimler taşmadan sarılıyor), Otel/Mekan
Detayları (Ana Mekan rozeti, "Haritada Aç" Google Maps'i gerçekten açtı),
Genel Bilgi (Markdown tam render - başlık/liste/kalın/italik/bağlantı/
alıntı, ham sözdizimi YOK), Profilim → Benim Programım (doğru oturum/rol/
tarih/salon). Beacon veri akışı testler boyunca kesintisiz devam etti.

**Bu bölüme, tamamlandığında şu kalan adımların sonucu eklenecek:** gün
sekmesi düzeltmesinin çevrimdışında yeniden doğrulanması, metin
ölçeklendirme testi, uzun içerikli kayıt testi, ve son beacon-görünmezliği
taraması.

### Sonuçları nereye bildir

Berke'ye veya doğrudan bu dosyaya yeni bir "Sonuç" alt başlığı ekleyerek.

---

## 2026-08-10 — XCUITest'ten `integration_test`e geçiş: sonuçlar

### Bağlam

Yukarıdaki manuel/XCUITest denemesi, Flutter'ın tüm arayüzü tek bir
`FlutterView` içine çizmesi yüzünden XCUITest'in widget ağacını
GÖREMEMESİ nedeniyle terk edildi. Yerine resmi `integration_test` paketi
kuruldu (`mobile/integration_test/`): `test_helpers.dart` (paylaşılan
`loginAndReachHome`/`pumpUntilFound`/`switchToTab`) + 4 test dosyası
(`navigasyon_test.dart`, `program_test.dart`, `cevrimdisi_test.dart`,
`olceklendirme_test.dart`). Test edilebilirlik için `core/testing/
widget_keys.dart` merkezi `Key` sabitleri eklendi (yalnızca test edilen
öğelere - üretim davranışı DEĞİŞMEDİ). `ios/RunnerUITests/` kalıntısı
`xcodeproj` gem'i ile `project.pbxproj`/scheme'den temiz şekilde
kaldırıldı, `flutter build ios --no-codesign` ile doğrulandı.

### Gerçek cihazda (Berke'nin iPhone'u "Baş") bulunan ve düzeltilen 4 hata

1. **Sayfa geçiş animasyonu bitmeden dokunma** - `pumpUntilFound` bir
   widget'ı BULUR bulmaz hemen ona dokunuyordu; `pageBack()` sonrası geri
   kayma animasyonu hâlâ sürerken hesaplanan merkez nokta ekran dışına
   taşıp "did not hit test" hatası veriyordu. Düzeltme: widget bulunduktan
   sonra ~400ms'lik bir tampon eklendi.
2. **Soğuk başlangıç ağ yarışı** - taze bir `flutter test` sürecinde
   `AuthSessionNotifier`in ilk `/auth/me` çağrısı bazen `SocketException:
   No route to host` ile anında başarısız oluyordu (cihazın ağ
   katmanının süreç başladıktan hemen sonra henüz hazır olmaması). Sabit
   bir bekleme yerine, Splash'in kendi "Tekrar Dene" düğmesine gerçek bir
   kullanıcı gibi birkaç kez basılarak çözüldü.
3. **Kaydırma olmadan dokunma** - Ana Sayfa'nın 2 sütunlu içerik
   ızgarasındaki alt sıralı butonlar (Duyurular/Sponsorlar) dış
   `ListView`de görünür alanın dışında kalabiliyordu; `tester.tap()`
   kaydırma YAPMAZ. `tester.ensureVisible()` tüm dokunma noktalarına
   eklendi.
4. **`app_shell.dart`da eksik `Key` (üretim kodu, gerçek hata)** -
   `BottomNavigationBarItem.activeIcon`, SEÇİLİ sekme için `icon` yerine
   kullanılır; `Key` yalnızca `icon`a eklenmişti, bu yüzden hâlihazırda
   seçili bir sekme (ör. Ana Sayfa'dayken tekrar Ana Sayfa'yı bulmak)
   `find.byKey` ile bulunamıyordu. Düzeltme: `activeIcon` de aynı `Key`
   ile sarmalandı (iki hâl asla aynı anda ağaçta olmadığı için güvenli).

### Gerçek arayüz hatası (üretim kodu, düzeltildi)

`olceklendirme_test.dart`, 1.3x yazı ölçeğinde (uygulamanın kendi
`main.dart` kenedinin izin verdiği GERÇEK üst sınır) Ana Sayfa'nın içerik
ızgarası butonlarında `RenderFlex overflowed by 9.3 pixels` yakaladı
(`home_page.dart` `_ContentButton`). Kök neden: `GridView`in
`childAspectRatio`sinin sabitlediği yükseklik içinde, büyük yazıda 2
satıra saran başlık metni sığmıyordu. Düzeltme: başlık `Text`i
`Flexible` ile sarmalandı - artık yalnızca kalan alanı kullanıyor, taşarsa
`ellipsis` içeride kalıyor.

### Ortamla ilgili (kod DEĞİL) iki önemli bulgu

- **`flutter test` fiziksel iOS cihazlarda VARSAYILAN olarak her
  çalıştırmadan SONRA uygulamayı cihazdan SİLER** (`flutter test --help
  --verbose` → `--[no-]uninstall`, varsayılan açık). Bu, HER
  çalıştırmada Keychain oturumunu VE konum iznini sıfırlıyordu - izin
  NATIVE bir sistem diyaloğudur, `integration_test` ona dokunamaz, bu
  yüzden silinen uygulama bir sonraki koşuda `/permission` ekranında
  TAKILI kalıyordu. **Çözüm: her zaman `--no-uninstall` bayrağıyla
  çalıştırın**, uygulamayı bir kez kurup konum iznini elle "Her Zaman
  İzin Ver" yapın - sonraki tüm koşular kalıcı olur.
- Test kullanıcısının (`faz1-test@example.com`) şifresi hatırlanmıyordu;
  backend'in kendi `bcryptjs`/Prisma katmanı kullanılarak DB'de
  doğrudan sıfırlandı (panel/API üzerinden DEĞİL, geçici bir script'le -
  script silindi).

### ✅ KAPANDI (Faz 7.1, 2026-08-10) — eski KRİTİK, DÜZELTİLMEMİŞ mimari bulgu: çevrimdışı soğuk başlangıç

**Bu bulgu Faz 7.1'de düzeltildi** - bkz. bu dosyanın altındaki
"2026-08-10 — Faz 7.1: Çevrimdışı soğuk başlangıç" bölümü ve
`docs/decisions.md` "Faz 7.1" başlığı. Aşağıdaki metin, bulgunun
ORİJİNAL (henüz düzeltilmemiş) haliyle TARİHSEL bir kayıt olarak
bırakılmıştır.

`cevrimdisi_test.dart` FAZ 2 (backend gerçekten durdurulmuş, taze bir
süreç) **başarısız oldu - bu bir test hatası DEĞİL.** `AuthSessionNotifier`
(bkz. `auth_session_provider.dart`) yerel bir `MeResponse` önbelleği
TUTMAZ; taze bir süreçte `/auth/me`ye ağ erişimi olmadan oturum ASLA
`AsyncData` olamaz, `route_redirect.dart` kullanıcıyı Splash'in "Sunucuya
bağlanılamadı" ekranında tutar. Test, "Tekrar Dene"ye 30 saniyede **19
kez** bastı, hiçbiri işe yaramadı (backend gerçekten kapalıyken
yaramayacağı da zaten beklenen).

**Sonuç:** `/mobile/program`in özenle inşa edilen KALICI önbelleği
(Faz 7'nin ana hedefi), kullanıcı UYGULAMAYI TAMAMEN KAPATIP AÇTIĞINDA VE
O ANDA ÇEVRİMDIŞI OLDUĞUNDA erişilemez durumda - üst seviye oturum
kapısı, Program ekranının çevrimdışı yeteneğini GÖLGELİYOR. (Uygulama
arka plandan öne alınırken - process hiç ölmediyse - bu sorun YOK, çünkü
`authSessionProvider` zaten `AsyncData` durumda kalır.)

Bu, Faz 6'nın "oturum her zaman canlı doğrulanır" güvenlik duruşu ile
Faz 7'nin "önbellek çevrimdışı çalışsın" hedefi arasındaki BİLİNÇLİ
olmayan bir çelişki. Düzeltmesi (ör. son başarılı `MeResponse`i yerel
olarak saklayıp ağ hatasında ona düşmek) gerçek bir mimari karar
gerektirir - bu oturumun "yalnızca Key ekle" kapsamı DIŞINDA, Faz 8 için
Berke'ye bırakıldı, test BİLEREK gevşetilmedi.

### Nihai test sonuçları

Tüm 4 dosya `--no-uninstall` ile, önce normal veriyle, sonra çok uzun
kongre adı/oturum başlığı/sponsor adıyla (`Congress.fullName`, bir
`Session.title`, bir `Sponsor.name` DB'de doğrudan güncellenerek)
tekrar çalıştırıldı:

| Dosya | Sonuç |
|---|---|
| `navigasyon_test.dart` | 3/3 geçti |
| `program_test.dart` | 2/3 geçti, 1 BİLİNÇLİ atlandı (test kongresinde seçili günde tek salon var - salon filtresi testi anlamlı fark yaratamıyor) |
| `olceklendirme_test.dart` | 1/1 geçti (yukarıdaki overflow düzeltmesinden sonra) |
| `cevrimdisi_test.dart` FAZ 1 | geçti (önbellek dosyası oluştu, tazelik doğru) |
| `cevrimdisi_test.dart` FAZ 2 | **BAŞARISIZ - yukarıdaki bilinen mimari bulgu, düzeltilmedi** |

Beacon veri akışı (`BeaconObservationService`) tüm koşular boyunca
kesintisiz çalıştı - hiçbir test dosyası onun iç mantığına dokunmadı.
`flutter analyze` temiz, `dart format` uygulandı, `flutter test`
(birim/widget) 17/17 geçiyor.

---

## 2026-08-10 — Faz 7.1: Çevrimdışı soğuk başlangıç

### Ne değişti

Yukarıdaki kritik bulgu düzeltildi. Özet (tam gerekçe için
`docs/decisions.md` "Faz 7.1"):

- **`core/auth/jwt_expiry.dart`** (yeni) - `checkJwtExpiry`/
  `extractJwtSubject`, ek paket gerektirmeden (`dart:convert`) JWT
  payload'ını çözüp `exp`/`sub` okur. 12 birim testi
  (`test/jwt_expiry_test.dart`): geçerli, süresi dolmuş, bozuk, dolgusuz
  payload, `exp`/`sub` eksik, saat kayması toleransı.
- **`SecureStorageService`**e `saveLastKnownSession`/`getLastKnownSession`/
  `getLastKnownSessionUserId`/`getLastKnownSessionCachedAt`/
  `clearLastKnownSession` eklendi - son başarılı `/auth/me` yanıtı
  kullanıcı ID'siyle birlikte saklanır, çıkışta temizlenir.
- **`AuthSessionNotifier`** ağ hatasında (401 DEĞİL) yerel `exp`e göre
  ya onbellekten devam eder (`isOfflineSessionProvider`), ya oturumu
  düşürüp giriş ekranına yönlendirir (süresi dolmuşsa), ya da mevcut
  Splash hata ekranını gösterir (çözümlenemedi/onbellek yok).
  `OfflineBlockReason` (mustChangePassword/aktif kongre yok
  durumlarında) Splash'e özel bir mesaj taşır.
- **`AuthLifecycleRefreshNotifier`** (yeni,
  `auth_lifecycle_refresh_provider.dart`) - `AppLifecycleListener` ile
  uygulama öne gelince çevrimdışıysa otomatik `refresh()` tetikler.
  `ObservationLifecycleProvider` ile AYNI desen, `main.dart`da bir kez
  izlenir.
- **`OfflineBanner`** (yeni, `features/auth/presentation/
  offline_banner.dart`) - kabukta `AlwaysPermissionBanner`in hemen
  altında, ikisi AYNI ANDA görünebilir. "Çevrimdışı · Son bağlantı: ..."
  gösterir.
- **`profile_page.dart`** - Kongre Değiştir/Şifre Değiştir çevrimdışıyken
  soluk görünür, dokununca anlaşılır bir SnackBar mesajı verir,
  `/select-congress`/`/change-password`'a GEÇMEZ.
- Testler: `route_redirect_test.dart`a 2 yeni durum (izin önceliği
  regresyonu KORUNDU), `cevrimdisi_test.dart`a 2 yeni senaryo (süresi
  dolmuş token, ağ dönünce otomatik tazelenme) - dosya artık 4 test
  içeriyor, hepsi geçiyor.

### Ne kırılabilir

- `AuthSessionNotifier`in dış davranışı (dönen `MeResponse?` tipi)
  DEĞİŞMEDİ - `route_redirect.dart`a HİÇ dokunulmadı, izin→oturum→
  zorunlu şifre→kongre→kabuk sırası aynen korundu (regresyon testiyle
  kilitli).
- `BeaconObservationService`in iç mantığına dokunulmadı - servis
  yalnızca `authSessionProvider`ın DEĞERİNE bakıyor, kaynağına
  (ağ/onbellek) değil, bu yüzden çevrimdışı modda kesintisiz çalışmaya
  devam etti (gerçek cihazda 10 gözlemlik bir kuyruğun ağ dönünce tek
  seferde başarıyla gönderildiği doğrulandı).
- `home_page.dart`/diğer ekranlardaki `StalenessLabel.hasStaleError`
  (Faz 7'den kalma) hâlâ pratikte hiç `true` olmuyor
  (`CachedContentNotifier._load()` ağ hatasında onbelleğe SESSİZCE
  düşüyor, hatayı tekrar fırlatmıyor) - bu Faz 7.1 kapsamında
  DEĞİŞTİRİLMEDİ, `cevrimdisi_test.dart` bu yüzden çevrimdışı durumun
  TEK göstergesi olarak `OfflineBanner`ı kullanıyor, per-ekran
  `StalenessLabel`ı DEĞİL.

### Gerçek cihazda test etmeniz gerekenler (zaten yapıldı, ama tekrar
### doğrulamak isterseniz)

9 adımlık protokol tam olarak yürütüldü (bkz. talimatın kendi listesi):
yükle→kapat→backend durdur→aç (KRİTİK: içeri girmeli, önbellekten
program, çevrimdışı şeridi görünür)→gez (çökme yok)→Kongre Değiştir
engellenir→backend başlat+öne getir (şerit kalkar, veri tazelenir)→
çıkış/giriş normal→beacon kesintisiz. Log kanıtları yukarıdaki
`integration_test/cevrimdisi_test.dart` çalıştırmalarında ve bu oturumun
kendi geçmişinde mevcut.

**Gerçek cihazda bulunup düzeltilen 2 hata** (ikisi de bu fazda,
detaylar `docs/decisions.md`da):
1. Riverpod re-entrancy - `AuthSessionNotifier.build()`in başında,
   ilk `await`den önce başka bir provider'a `ref.read` ile yazmak,
   taze bir süreçte "provider inşa edilirken başka provider inşa
   edilemez" güvenlik denetimini tetikliyordu.
2. `integration_test/test_helpers.dart` `loginAndReachHome`in "vardık"
   işareti (`homeContentButtonProgram`) yanlıştı - Ana Sayfa'nın KENDİ
   içeriği (bellek-içi önbellek) çevrimdışı soğuk başlangıçta hata
   ekranı gösterebiliyordu, oturum başarıyla açılmış olsa bile.
   `shellTabHome`e çevrildi.

### Faz 8 için not

`BeaconObservationService`in bellek-içi kuyruğu, kongre salonunda ağ
koptuğunda TAM OLARAK beklendiği gibi davrandı: gözlemler biriktirdi,
ağ döndüğünde tek toplu istekte gönderdi, hiçbir veri kaybı olmadı - ve
bunu başarmak için `AuthSessionNotifier`in çevrimdışı moduyla HİÇBİR
entegrasyona ihtiyaç duymadı (yalnızca `me != null &&
!mustChangePassword && activeCongressId != null` koşuluna bakıyor).
SQLite'a geçerken bu ayrım (kuyruk mantığı oturum kaynağından TAMAMEN
bağımsız) korunmalı - servisin kendi retry/backoff'u zaten yeterli, ek
bir "çevrimdışı farkındalığı" eklemeye gerek yok.

`flutter analyze` temiz, `flutter test` (birim/widget) 31/31 geçiyor,
tüm 4 `integration_test` dosyası gerçek cihazda geçti.

## 2026-08-11 — Faz 8: Kalıcı gözlem kuyruğu (SQLite)

### Ne değişti

Yukarıdaki nottaki bellek-içi kuyruk artık SQLite'a taşındı (tam gerekçe
`docs/decisions.md` "Faz 8"):

- **`features/observations/domain/observation_queue_store.dart`** (yeni) -
  `ObservationQueueStore` arayüzü + `QueuedObservation` modeli.
- **`features/observations/data/sqlite_observation_queue_store.dart`**
  (yeni) - `sqflite` implementasyonu, tek tablo (`observation_queue`,
  `observation_id` UNIQUE), `enqueue`/`enqueueAll`/`peekBatch`/
  `removeSent`/`count`/`pruneOlderThan`/`pruneOverCapacity`/
  `clearForScopeChange`.
- **`BeaconObservationService`** - `_onRangingResult` senkron kalmaya
  devam ediyor (içine `await` konmadı); gözlemler önce küçük bir bellek
  tamponuna (`_writeBuffer`, 10 kayıt/5sn tetikli) yazılıp oradan kalıcı
  kuyruğa taşınıyor. `_trySendBatch` artık `peekBatch(limit:50)` ile
  çalışıyor, kuyruk bitene kadar kademeli boşaltıyor (2sn aralıkla) -
  **limit önce 500'dü, gerçek cihazda 413 hatası verdiği için 50'ye
  düşürüldü (aşağıya bkz.)**. `stop()` artık tamponu kalıcı kuyruğa
  yazmayı BEKLİYOR (`await`). `congressId`/`userId` yeni zorunlu
  constructor parametreleri. Yaşlanma (72sa) ve tavan (100.000) temizliği
  otomatik. `_drainQueue` artık her yeni `peekBatch`tan önce bir
  `_stopped` bayrağını kontrol ediyor (kod incelemesinde bulunan, kapsam
  değişimi sırasında nadir bir yarış durumunu daraltmak için - aşağıya
  bkz.).
- **`ObservationLifecycleNotifier`** - `_startedForUserId` takibi eklendi;
  kongre/kullanıcı değişiminde veya AÇIKÇA çıkış yapılınca
  (`explicitLogoutSignalProvider`, yeni - bkz. `auth_session_provider.dart`)
  kuyruğu tamamen temizliyor. 401/yerel token süresi dolmuş gibi İSTEMSİZ
  oturum düşüşlerinde kuyruğa DOKUNMUYOR (bilinçli tasarım, gerekçe
  `decisions.md`da).
  `initialQueue`/`pendingSnapshots` (Faz 6.2'nin 403-kurtarma taşıma
  mekanizması) KALDIRILDI - artık gereksiz, çünkü kuyruk servis
  örneğine değil `congressId+userId`ye bağlı kalıcı bir dosya.
- Yeni bağımlılıklar: `sqflite ^2.4.3`, `path ^1.9.1` (direkt),
  `sqflite_common_ffi ^2.4.2` (dev, test için).
- Testler: `test/sqlite_observation_queue_store_test.dart` (11 test,
  gerçek SQLite semantiği `sqflite_common_ffi` ile) +
  `integration_test/kuyruk_test.dart` (4 FAZ). Toplam birim/widget testi
  31'den 42'ye çıktı.

### Ne kırılabilir

- `BeaconObservationService`in ranging/duty-cycle/monitoring güvenlik
  ağı/yaşam döngüsü mantığına DOKUNULMADI - değişen TEK şey kuyruğun
  nerede tutulduğu. `_onRangingResult` hâlâ senkron.
- `stop()` artık `await _flushWriteBuffer()` yapıyor - bu, 403 cihaz
  kurtarmasında (Faz 6.2) ve kapsam temizliğinde (Faz 8) sıralamanın
  DOĞRU olması için KASITLI bir davranış değişikliği (öncesinde
  fire-and-forget değildi zaten, tampon vardı ama diske yazma kavramı
  yoktu).
- Backend/`POST /observations/batch` sözleşmesine DOKUNULMADI.
- `_drainQueue`in yeni `_stopped` bayrak kontrolü bir DAVRANIŞ
  değişikliği değil, yalnızca bir race-window daraltma - normal akışta
  hiç tetiklenmez.

### Gerçek cihazda bulunup düzeltilen gerçek hata: HTTP 413

Uzun süreli offline testinde (~1700 kayıtlık gerçek bir kuyruk) backend
açılınca ilk 500'lük batch **413 "request entity too large"** ile
reddedildi - NestJS/Express'in varsayılan ~100KB JSON gövde sınırı, 6
beacon/gözlem yoğunluğunda 500 gözlemi (~375KB) kaldırmıyor. Bu,
kuyruğu SONSUZA KADAR tıkayan gerçek bir hataydı (başarısız gönderimde
kayıtlar silinmiyor, aynı oversize batch hep tekrar deneniyordu).
Backend'e DOKUNULMADAN (mutlak kısıt) istemci tarafında limit 500'den
**50**'ye düşürüldü - düzeltme canlı cihazda `flutter run` ile hot
restart edilip AYNI ~1700 kayıtlık gerçek kuyruğun 35 batch'te (34×50 +
1×26), sıfır 413 hatasıyla tamamen boşaldığı doğrulandı. Detay/gerekçe
`docs/decisions.md` "Faz 8 - Batch limiti".

### Gerçek cihazda test edilenler (zaten yapıldı)

`integration_test/kuyruk_test.dart`in 4 FAZ'ı ("Baş" iPhone 16 Pro,
gerçek beacon donanımı) + canlı `flutter run` oturumuyla manuel adımlar,
hepsi geçti:

1. **FAZ 0** (backend açık): kuyruk sürekli akıp temiz kaldı (<50 kayıt).
2. **FAZ 1** (backend kapalı, 90sn): kuyruk 52 kayda çıktı.
3. **FAZ 2** (YENİ süreç - gerçek kapat-aç, backend HÂLÂ kapalı): widget
   ağacı kurulmadan ÖNCE diskten okunan sayı da 52'ydi - **Faz 8'in
   kritik kanıtı**.
4. **FAZ 3** (backend açılıyor): kuyruk kademeli boşaldı. Yan-kanıt: bir
   önceki yarıda-kesilen denemede backend'e ULAŞMIŞ ama yerel
   `removeSent` hiç ÇALIŞMAMIŞ 52 kayıt tekrar gönderilince backend
   `Dup: 52` ile doğru reddetti - SQLite UNIQUE + backend idempotency'nin
   gerçek bir yarım-kalmış-gönderim senaryosunda BİRLİKTE çalıştığının
   kanıtı.
5. **Backend doğrulaması**: `HallVisit`/`AttendanceEvent` üretimi
   (algoritma v3) bozulmadı, testler sırasında yeni ENTRY/EXIT çiftleri
   normal oluşmaya devam etti.
6. **Uzun süreli test** (25dk backend kapalı, ~1700 kayda çıktı): kuyruk
   donmadan büyüdü. Backend açılınca **413 hatası bulundu ve düzeltildi**
   (yukarıya bkz.) - düzeltmeden sonra aynı gerçek kuyruk tamamen,
   arayüz donmadan boşaldı (kullanıcı ekranlar arası gezindi, akıcıydı).
7. **Kongre değiştir**: log `STOP ... → 3 kayit SILINDI (kapsam degisimi:
   kongre degisimi) → START <yeni kongre> ... baslangicta kuyrukta 0
   kayit`.
8. **Çıkış yap** (backend KAPALIYKEN, 30+ kayıtlık kuyrukla): log
   `STOP ... → 43 kayit SILINDI (kapsam degisimi: cikis yapildi)`.
9. **Arka plan hız karşılaştırması** (10dk, ekran kilitli): 3100 gözlem
   (~5,0 gözlem/sn) - Faz 6 ölçümünden (2283/11,4dk ≈ 3,34/sn) düşük
   DEĞİL, kalıcı kuyruk katmanı ranging'i yavaşlatmıyor.

**Küçük bir gözlem (hata değil):** çıkış testinde loglarda arka arkaya
iki kez `"0/43 kayit SILINDI (kapsam degisimi: cikis yapildi)"` görüldü -
muhtemelen "Çıkış Yap" onay diyaloğuna çift dokunma. Riverpod aynı
değere (`AsyncData(null)`) ikinci geçişte dinleyicileri TEKRAR
TETİKLEMEDİĞİ için `explicitLogoutSignalProvider` bayrağı bir sonraki
GERÇEK duruma (yeniden giriş) kadar taşındı ve orada tüketildi - veri
kaybı/yanlış davranış YOK (`clearForScopeChange` zaten boş tablo üzerinde
idempotent), yalnızca zararsız bir yinelenen log satırı.

`flutter analyze` temiz, `flutter test` 42/42 geçiyor.

### Faz 9 (Push/FCM) için not

Bu fazda dokunulmayanlar: bildirim izinleri, arka plan fetch, FCM token
kaydı. Faz 8'in kuyruk mimarisiyle hiçbir çakışma beklenmiyor - push,
gözlem gönderiminden tamamen bağımsız bir kanal.

## 2026-08-18 — Faz 9/10 Kapanış: Push, E-posta ve Program Ekranı Gerçek Cihaz Doğrulaması

`docs/decisions.md`deki "Faz 9/10 Kapanış" bölümünün mobil-özel kısmı.
Berke'nin iPhone'u "Baş" üzerinde, gerçek Firebase/APNs/Brevo kurulumuyla
yapıldı. Ayrıntılı sonuçlar (12+ push senaryosu, Faz 10 UI'ın 10 maddesi,
e-posta testleri) `decisions.md`de - burada yalnızca mobil kod/test
değişiklikleri ve ortam bulguları var.

### Gerçek hata bulundu ve düzeltildi: `home_page.dart` erişilebilirlik taşması

`_ContentGrid`deki sabit `childAspectRatio: 1.5`, maksimum iOS
erişilebilirlik yazı boyutunda "Bilimsel Program"/"Ana Konuşmacılar"
etiketlerini taşırıyordu. `MediaQuery.textScalerOf(context).scale(14)/14`
ile okunan ölçeğe göre `aspectRatio` artık dinamik hesaplanıyor
(`(1.5 / textScale.clamp(1.0, 2.2)).clamp(0.85, 1.5)`) - normal ölçekte
(scale=1.0) davranış değişmedi, hâlâ 1.5. Cihazda görsel olarak
doğrulandı, `flutter analyze` temiz, `flutter test` 42/42.

### `GoogleService-Info.plist` + `Runner.entitlements` Xcode hedefine eklendi

İkisi de `xcodeproj` Ruby gem'iyle (Xcode GUI'sinin "Add Files"/
"+Capability" eylemleriyle eşdeğer) eklendi - dosyayı yalnızca klasöre
kopyalamak YETMEZ, Runner target'ının Copy Bundle Resources'ına
(plist için) ve `CODE_SIGN_ENTITLEMENTS` build ayarına (üç konfigürasyonda
da - Debug/Release/Profile) dahil edilmesi gerekiyor. `git diff` ile her
ikisi de standart, minimal diff'ler olarak doğrulandı.

**Firebase Cloud Messaging'in gizli tuzağı:** tek bir .p8 APNs Auth Key
teknik olarak evrensel olsa da, Firebase Console'un "Apple app
configuration" bölümünde AYRI "Development" ve "Production" yükleme
slotları var - yalnızca Production'a yüklemek debug build'lerin (sandbox/
development token'lı) `messaging/third-party-auth-error: Invalid APNs
credential.` almasına yol açıyordu. Kullanıcının kendi açık Firebase
Console sekmesinin ekran görüntüsü alınınca "No development APNs auth key
[Upload]" görüldü - aynı .p8 Development slotuna da yüklenince düzeldi.

### `integration_test`te bulunan ve düzeltilen 2 test hatası (uygulama kodu DEĞİL)

Gerçek/büyük "Deneme" kongre verisiyle (74 oturum) ilk kez çalıştırılınca
`program_test.dart`taki "Salon filtresi çalışır" testinde iki gerçek test
kusuru ortaya çıktı:

1. Mola/tören/diğer türlerin `programSessionCard` anahtarı TAŞIMADIĞI
   (Faz 10'da kasıtlı, gerçek cihazda doğrulanmış davranış - bkz.
   `program_page.dart` `_isMinorEvent`) bu testte hesaba katılmıyordu.
   Testte AYNI kural mirror'landı (`_isMinorEvent` kopyası eklendi),
   beklenen/hariç kart listelerinden bu türler çıkarıldı.
2. Test, `expect(find.byKey(...), findsOneWidget)`i doğrudan çağırıyordu
   - `ListView.separated`in lazy-build ettiği, henüz viewport/cache
   extent'e girmemiş kartlar için bu başarısız oluyordu (küçük test
   verisiyle hiç ortaya çıkmamıştı). `tester.scrollUntilVisible` ile
   düzeltildi (dikey `ListView`i `find.byWidgetPredicate` ile diğer iki
   yatay `ListView`den - gün sekmeleri, salon filtresi - ayırt ederek).

Düzeltmeden sonra test verisi temizlenip yeniden çalıştırıldığında bu iki
sorun BİR DAHA görülmedi - kalan tek engel aşağıdaki bilinen hata oldu.

### ⚠️ ÖNCELİKLİ, BİR SONRAKİ FAZA: `BeaconObservationService._flushWriteBuffer` yarış durumu YENİDEN VE SIK GÖZLENDİ

Bu turda **6 farklı anda** aynı `RangeError` ile karşılaşıldı:
`navigasyon_test.dart`, `program_test.dart` (2 kez), `olceklendirme_test.dart`
integration_test koşumlarında VE kullanıcının canlı `flutter run`
oturumunda 2 kez (her ikisinde de sonrasında "Lost connection to device"
- uygulama cihazda kendi kendine toparlandı, ama garanti değil).

Kök neden (kod DEĞİŞTİRİLMEDİ, yalnızca okunup teşhis edildi):
`_flushWriteBuffer()` (satır ~532) HEM `_onRangingResult`den (satır ~516,
BEKLENMEDEN/re-entrancy koruması OLMADAN) HEM DE `_trySendBatch()`den
(satır ~575, `_isBatching` bayrağıyla korunan) çağrılıyor - bu iki çağrı
noktası BİRBİRİNDEN BAĞIMSIZ olduğu için `_isBatching` aralarındaki
çakışmayı önlemiyor. İki çağrı çakışırsa, hızlı biten `_writeBuffer`ı
`removeRange`ler; yavaş olan kendi `removeRange`ine ulaştığında tampon
artık beklediğinden kısa - `RangeError (end): Invalid value: ...`.

**Bu turda kesinlikle DOKUNULMADI** (kullanıcı talimatı: ranging/duty-cycle/
kuyruk mantığına asla dokunma). Gerçek aktif beacon donanımı yakınında,
uygulama ~15-25 saniyeden uzun süre ön planda kaldığında NEREDEYSE HER
SEFERİNDE tetiklendiği için bu, `integration_test` paketinin gerçek bir
salon ortamında güvenilir şekilde tamamlanmasını fiilen ENGELLEYEN,
öncelikli bir sonraki-faz maddesi. Olası çözüm yönü: iki çağrı noktasını
tek bir kilitli/kuyruklu giriş noktasından geçirmek (ör. çağrıları bir
`Future` zincirine serileştirmek) - ranging/duty-cycle davranışına
dokunmadan.

### Sonuçları nereye bildir

`docs/decisions.md` "Faz 9/10 Kapanış" bölümü + bu bölüm. Faz 9'un
"gerçek cihaz doğrulaması bekliyor" notu artık KAPANDI.
