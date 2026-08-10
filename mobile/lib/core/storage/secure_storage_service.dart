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
  static const String _beaconUuidKey = 'beacon_uuid';
  static const String _beaconUuidCongressIdKey = 'beacon_uuid_congress_id';
  static const String _announcementsLastSeenPrefix = 'announcements_last_seen_';

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

  // Beacon takibi icin gereken UUID, kongreye gore degisir - `/mobile/bootstrap`
  // her basariyla cagrildiginda buraya hangi kongre icin oldugu bilgisiyle
  // birlikte yazilir. Amac, ag olmadan acilan bir oturumda (bkz. Faz 6.1
  // talimati "cevrimdisi dayaniklilik") son bilinen UUID ile takibe devam
  // edebilmek - ama yalnizca AYNI kongre icin, farkli bir kongrenin eski
  // UUID'siyle YANLIS salonlar takip edilmesin diye.
  Future<void> saveBeaconUuid(String congressId, String beaconUuid) async {
    await _storage.write(key: _beaconUuidCongressIdKey, value: congressId);
    await _storage.write(key: _beaconUuidKey, value: beaconUuid);
  }

  /// `congressId` kaydedilen degerle eslesmiyorsa `null` doner - bayat
  /// (farkli kongreye ait) bir UUID asla sessizce kullanilmasin diye.
  Future<String?> getBeaconUuidForCongress(String congressId) async {
    final savedCongressId = await _storage.read(key: _beaconUuidCongressIdKey);
    if (savedCongressId != congressId) return null;
    return _storage.read(key: _beaconUuidKey);
  }

  // "Okunmamis duyuru" rozeti icin - sunucu bu durumu TUTMAZ (bkz. Faz 7
  // talimati §2, docs/decisions.md Faz 5). Kongreye gore anahtarlanir
  // (beaconUuid ile ayni sebep: kongre degistiginde BASKA bir kongrenin
  // "son gorulen" damgasi yanlislikla kullanilmasin).
  Future<void> saveAnnouncementsLastSeen(
    String congressId,
    DateTime seenAt,
  ) async {
    await _storage.write(
      key: '$_announcementsLastSeenPrefix$congressId',
      value: seenAt.toIso8601String(),
    );
  }

  Future<DateTime?> getAnnouncementsLastSeen(String congressId) async {
    final value = await _storage.read(
      key: '$_announcementsLastSeenPrefix$congressId',
    );
    if (value == null) return null;
    return DateTime.tryParse(value);
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
