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
