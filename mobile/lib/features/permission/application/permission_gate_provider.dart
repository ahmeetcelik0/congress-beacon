import 'dart:async';

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

  /// Ham [AuthorizationStatus]'u dondurur (basarisizlikta null) - `state`i
  /// de yan etki olarak gunceller. `requestPermission`'in notDetermined'i
  /// denied'dan ayirt edebilmesi icin ham durum gerekli (bkz. asagisi).
  Future<AuthorizationStatus?> _check() async {
    try {
      final status = await flutterBeacon.authorizationStatus;
      state = _isSufficient(status)
          ? PermissionGateStatus.sufficient
          : PermissionGateStatus.insufficient;
      return status;
    } catch (_) {
      state = PermissionGateStatus.insufficient;
      return null;
    }
  }

  /// Uygulama one geldiginde (kabuktaki AlwaysPermissionBanner disinda,
  /// izin ekranindan cikildiktan SONRA kullanici Ayarlar'dan izni geri
  /// alirsa bunu yakalamak icin) durumu yeniden sorar.
  Future<void> refresh() => _check();

  /// "Izin Ver" butonuna basilinca cagrilir - OS izin dialogunu tetikler.
  ///
  /// Gercek cihazda gozlemlenen bir CoreBluetooth sorunu icin bir defalik
  /// otomatik yeniden deneme icerir: `flutter_beacon`, konum iznini
  /// istemeden once native tarafta CBCentralManager'in "poweredOn" durumuna
  /// gelmesini bekliyor (beacon taramasi ikisine de ihtiyac duydugu icin,
  /// bkz. FlutterBeaconPlugin.m). Uygulamanin SOGUK acilisinda bu callback
  /// bazen gec/gelmiyor - Bluetooth zaten acik olsa bile - ve sonuc olarak
  /// OS'un konum izni penceresi HIC CIKMIYOR, durum notDetermined'de
  /// kaliyor. Bu, sahada "Bluetooth'u kapatip acinca duzeliyor" olarak
  /// gozlemlendi - ama kullanicidan bunu istemek kabul edilemez. Durum hala
  /// notDetermined ise (kullanici gercekten "Izin Verme" DEMEDI, sadece
  /// pencere hic gelmedi) kisa bir bekleme sonrasi BIR KEZ tekrar denenir;
  /// bu, CBCentralManager'in gercek durumuna kavusmasi icin yeterli oluyor.
  Future<bool> requestPermission() async {
    // `BeaconObservationService` kok seviyesinde ACILISTA KENDILIGINDEN
    // ayni native baslatmayi (flutter_beacon) tetikliyor (bkz. Faz 6 §7,
    // "arka planda ranging asla durdurulmaz"). Izin o akistan zaten
    // yeterli hale geldiyse burada `initializeAndCheckScanning`i TEKRAR
    // cagirmak, native tarafta CBCentralManager'in AYNI ANDA iki kez
    // baslatilmasina yol acip Future'in HIC TAMAMLANMAMASINA sebep
    // olabiliyor - ekran sonsuza dek "Izin Ver" yukleme durumunda kaliyor
    // (saha testinde dogrulandi, uygulamayi kapatip acinca duzeliyordu
    // cunku `build()`teki ilk kontrol izni zaten yeterli bulup bu ikinci
    // native cagriyi hic yapmiyordu). Native cagriya gitmeden once ucuz
    // bir durum kontrolu yeterliyse dogrudan donulur.
    final current = await _check();
    if (current != null && _isSufficient(current)) {
      return true;
    }

    final firstAttempt = await _requestOnce();
    if (firstAttempt == AuthorizationStatus.notDetermined) {
      await Future<void>.delayed(const Duration(milliseconds: 700));
      await _requestOnce();
    }
    return state == PermissionGateStatus.sufficient;
  }

  Future<AuthorizationStatus?> _requestOnce() async {
    try {
      await flutterBeacon.initializeAndCheckScanning;
    } catch (_) {
      // Bluetooth kapali gibi bir sebeple basarisiz olabilir - yine de
      // asagida gercek yetkilendirme durumunu soruyoruz, orada dogru
      // sonucu aliriz.
    }
    return _check();
  }
}

final permissionGateProvider =
    NotifierProvider<PermissionGateNotifier, PermissionGateStatus>(
      PermissionGateNotifier.new,
    );
