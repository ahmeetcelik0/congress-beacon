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
