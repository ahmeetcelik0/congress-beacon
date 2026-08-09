import 'package:flutter_beacon/flutter_beacon.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum PermissionGateStatus {
  /// Durum henuz OS'tan sorulmadi (uygulama acilisi).
  loading,

  /// Konum izni yetersiz (denied/restricted/notDetermined) - gecilemez
  /// izin ekraninda kalinmali.
  insufficient,

  /// En az "Uygulamayi Kullanirken" (WhenInUse) / Android'de "allowed" -
  /// uygulama acilabilir. "Her Zaman" (Always) ayrimi burada YAPILMAZ,
  /// onu kabuktaki kalici serit (AlwaysPermissionBanner) ayrica, servisin
  /// kendi `needsAlwaysLocationPermission`'indan okuyarak gosterir (bkz.
  /// Faz 6 talimati §4.4 - "mevcut _refreshAlwaysPermissionStatus'u kullan").
  sufficient,
}

/// Uygulama girisindeki ZORUNLU izin ekraninin durumu. `beacon_observation_service.dart`
/// icindeki "Her Zaman" izleme mantigina DOKUNMAZ - o, servis calisirken
/// ayrica kendi kontrolunu yapar; bu provider yalnizca "uygulama acilabilir mi"
/// sorusuna cevap verir (bkz. Faz 6 talimati §4).
class PermissionGateNotifier extends Notifier<PermissionGateStatus> {
  @override
  PermissionGateStatus build() {
    // build() senkron olmak ZORUNDA (Notifier), bu yuzden ilk kontrol
    // arka planda baslatilip sonuc geldiginde state guncellenir.
    Future.microtask(_check);
    return PermissionGateStatus.loading;
  }

  bool _isSufficient(AuthorizationStatus status) {
    return status == AuthorizationStatus.always ||
        status == AuthorizationStatus.whenInUse ||
        status == AuthorizationStatus.allowed;
  }

  Future<void> _check() async {
    try {
      final status = await flutterBeacon.authorizationStatus;
      state = _isSufficient(status)
          ? PermissionGateStatus.sufficient
          : PermissionGateStatus.insufficient;
    } catch (_) {
      state = PermissionGateStatus.insufficient;
    }
  }

  /// Uygulama one geldiginde (kabuktaki AlwaysPermissionBanner disinda,
  /// izin ekranindan cikildiktan SONRA kullanici Ayarlar'dan izni geri
  /// alirsa bunu yakalamak icin) durumu yeniden sorar.
  Future<void> refresh() => _check();

  /// "Izin Ver" butonuna basilinca cagrilir - OS izin dialogunu tetikler.
  Future<bool> requestPermission() async {
    try {
      await flutterBeacon.initializeAndCheckScanning;
    } catch (_) {
      // Bluetooth kapali gibi bir sebeple basarisiz olabilir - yine de
      // asagida gercek yetkilendirme durumunu soruyoruz, orada dogru
      // sonucu aliriz.
    }
    await _check();
    return state == PermissionGateStatus.sufficient;
  }
}

final permissionGateProvider =
    NotifierProvider<PermissionGateNotifier, PermissionGateStatus>(
      PermissionGateNotifier.new,
    );
