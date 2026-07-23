import Flutter
import UIKit
import CoreLocation

// flutter_beacon eklentisi kendi CLLocationManager'inda
// `allowsBackgroundLocationUpdates`'i hic set etmiyor - bu olmadan iOS,
// uygulama arka plana alindiktan kisa sure sonra (region monitoring'in
// tetikledigi kisa "uyanma" pencereleri disinda) surecin kendisini askiya
// aliyor ve ranging guncellemeleri gelmeyi kesiyor (bkz. docs/decisions.md,
// arka plan ranging notu). Burada, eklentininkinden bagimsiz, sirf sureci
// arka planda canli tutmak icin ayri bir CLLocationManager kullaniyoruz;
// `allowsBackgroundLocationUpdates` surec genelinde etkili oldugu icin bu,
// ayni process icindeki flutter_beacon'in ranging guncellemelerinin de
// akmaya devam etmesini sagliyor.
@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, CLLocationManagerDelegate {
  private let backgroundKeepAliveLocationManager = CLLocationManager()

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    backgroundKeepAliveLocationManager.delegate = self
    configureBackgroundLocationIfAuthorized()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    // Kullanici izni sonradan "Her Zaman"a yukselttiginde (Ayarlar'dan veya
    // sistem promptundan) burada da yakalayip arka plan guncellemelerini
    // baslatiyoruz.
    configureBackgroundLocationIfAuthorized()
  }

  private func configureBackgroundLocationIfAuthorized() {
    guard CLLocationManager.authorizationStatus() == .authorizedAlways else { return }

    backgroundKeepAliveLocationManager.allowsBackgroundLocationUpdates = true
    backgroundKeepAliveLocationManager.pausesLocationUpdatesAutomatically = false
    // Mavi arka plan konum gostergesini kapatiyoruz - bu yalnizca gorsel bir
    // bayrak, allowsBackgroundLocationUpdates'ten bagimsiz; kapatmak surecin
    // arka planda canli kalmasini etkilemiyor. iOS varsayilani zaten false.
    backgroundKeepAliveLocationManager.showsBackgroundLocationIndicator = false
    backgroundKeepAliveLocationManager.startUpdatingLocation()
  }
}
