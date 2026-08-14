import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../models/auth_models.dart';

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
  // Faz 7.1 - cevrimdisi soguk baslangic icin son basarili `/auth/me`
  // yanitinin yerel kopyasi (bkz. asagidaki `saveLastKnownSession` yorumu).
  static const String _lastKnownSessionKey = 'last_known_session';
  static const String _lastKnownSessionUserIdKey = 'last_known_session_user_id';
  static const String _lastKnownSessionCachedAtKey =
      'last_known_session_cached_at';
  static const String _pushPermissionRequestedKey = 'push_permission_requested';

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

  // Faz 9: bildirim izni KONUM izninden farkli olarak ZORUNLU degil - tek
  // seferlik bir istektir (bkz. push_notification_lifecycle_provider.dart).
  // Bu bayrak, kullanici izni REDDETSE bile bir daha SORULMAMASI icin
  // (iOS zaten ayni etkiyi OS seviyesinde saglar - ikinci `requestPermission()`
  // cagrisi sistem diyalogunu tekrar GOSTERMEZ, sessizce onceki cevabi
  // doner - ama burada AYRICA tutulmasinin sebebi gereksiz SDK cagrisindan
  // kacinmak).
  Future<void> savePushPermissionRequested() async {
    await _storage.write(key: _pushPermissionRequestedKey, value: 'true');
  }

  Future<bool> isPushPermissionRequested() async {
    final value = await _storage.read(key: _pushPermissionRequestedKey);
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
    await clearLastKnownSession();
  }

  // --- Faz 7.1: cevrimdisi soguk baslangic ---
  //
  // `AuthSessionNotifier`, agdan basarili her `/auth/me` yanitini buraya
  // yazar. Ag hatasinda (cihaz TAMAMEN kapatilip agsiz acildiginda vb.)
  // token'in `exp`i hala gecerliyse bu kayit gosterilir - kullanici DAHA
  // ONCE mesru sekilde gordugu KENDI verisini gorur, yeni veri CEKILMEZ,
  // hicbir yazma islemi YAPILMAZ (bkz. docs/decisions.md "Faz 7.1" guvenlik
  // gerekcesi).

  /// [me] ile birlikte HANGI kullaniciya ait oldugu da saklanir - farkli
  /// bir hesapla giris yapildiginda eski kaydin YANLISLIKLA kullanilmasini
  /// onlemek `AuthSessionNotifier`in sorumlulugundadir (token'daki `sub` ile
  /// burada saklanan `userId`i karsilastirir), ama savunma amacli ikinci
  /// bir katman olarak burada da tutulur.
  Future<void> saveLastKnownSession(MeResponse me) async {
    await _storage.write(key: _lastKnownSessionUserIdKey, value: me.user.id);
    await _storage.write(
      key: _lastKnownSessionKey,
      value: jsonEncode(me.toJson()),
    );
    await _storage.write(
      key: _lastKnownSessionCachedAtKey,
      value: DateTime.now().toIso8601String(),
    );
  }

  /// Kayit bozuksa/eksikse SESSIZCE `null` doner (bkz. `ContentCacheService`
  /// ile ayni desen - bozuk bir onbellek kalici bir hataya DONUSMEMELI).
  Future<MeResponse?> getLastKnownSession() async {
    final raw = await _storage.read(key: _lastKnownSessionKey);
    if (raw == null) return null;
    try {
      return MeResponse.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<String?> getLastKnownSessionUserId() async {
    return _storage.read(key: _lastKnownSessionUserIdKey);
  }

  Future<DateTime?> getLastKnownSessionCachedAt() async {
    final raw = await _storage.read(key: _lastKnownSessionCachedAtKey);
    if (raw == null) return null;
    return DateTime.tryParse(raw);
  }

  Future<void> clearLastKnownSession() async {
    await _storage.delete(key: _lastKnownSessionKey);
    await _storage.delete(key: _lastKnownSessionUserIdKey);
    await _storage.delete(key: _lastKnownSessionCachedAtKey);
  }
}
