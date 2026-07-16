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
