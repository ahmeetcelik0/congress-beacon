import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Cihazda saklanan TEK dogruluk kaynagi minimaldir - katilimci adi/kongre
/// adi gibi GORUNTULEME verisi artik burada TUTULMAZ (Faz 6 talimati §2):
/// bunlar her acilista `GET /auth/me`den taze gelir, yerel kopyasi
/// bayatlayip ekranda yanlis bilgi gosterebilirdi (ör. panelden ad-soyad
/// duzeltilirse). Yalnizca token/kimlik/bayrak niteligindeki degerler saklanir.
class SecureStorageService {
  SecureStorageService()
    : _storage = const FlutterSecureStorage(
        aOptions: AndroidOptions(),
        iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
      );

  final FlutterSecureStorage _storage;

  static const String _accessTokenKey = 'access_token';
  static const String _deviceIdKey = 'device_id';
  static const String _activeCongressIdKey = 'active_congress_id';
  static const String _permissionOnboardingCompleteKey =
      'permission_onboarding_complete';

  Future<void> saveAccessToken(String token) async {
    await _storage.write(key: _accessTokenKey, value: token);
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessTokenKey);
  }

  Future<void> deleteAccessToken() async {
    await _storage.delete(key: _accessTokenKey);
  }

  Future<void> saveDeviceId(String deviceId) async {
    await _storage.write(key: _deviceIdKey, value: deviceId);
  }

  Future<String?> getDeviceId() async {
    return await _storage.read(key: _deviceIdKey);
  }

  Future<void> deleteDeviceId() async {
    await _storage.delete(key: _deviceIdKey);
  }

  // Aktif kongre ID'si aslinda JWT'nin kendisinde tasinir (activeCongressId)
  // ve `/auth/me` her seferinde bunu dogrular - burada AYRICA saklanmasinin
  // tek amaci, `ObservationLifecycleNotifier`in kongre DEGISTIGINI (bir
  // onceki calistigi kongreyle yeni secileni karsilastirarak) tespit
  // edebilmesidir. Yetkilendirme kararlari icin ASLA tek basina
  // GUVENILMEZ - her zaman /auth/me'den gelen taze deger esas alinir.
  Future<void> saveActiveCongressId(String congressId) async {
    await _storage.write(key: _activeCongressIdKey, value: congressId);
  }

  Future<String?> getActiveCongressId() async {
    return await _storage.read(key: _activeCongressIdKey);
  }

  Future<void> savePermissionOnboardingComplete() async {
    await _storage.write(key: _permissionOnboardingCompleteKey, value: 'true');
  }

  Future<bool> isPermissionOnboardingComplete() async {
    final value = await _storage.read(key: _permissionOnboardingCompleteKey);
    return value == 'true';
  }

  /// Cikis yapinca veya 401 ile oturum dusunce cagrilir - cihaz kaydi
  /// (`deviceId`) BILINCLI olarak SILINMEZ: ayni fiziksel cihaz tekrar giris
  /// yaptiginda yeni bir `Device` satiri olusturmak yerine mevcut kaydi
  /// kullanmaya devam etsin (bkz. Faz 6 talimati §7, "zaten kayitli bir cihaz
  /// varsa tekrar kayit olusturmaktan kacin"). Izin onboarding bayragi da
  /// ayni sebeple silinmez - o, KONUM izninin cihaz duzeyinde durumunu
  /// yansitir, oturumla ilgisizdir.
  Future<void> clearSession() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _activeCongressIdKey);
  }
}
