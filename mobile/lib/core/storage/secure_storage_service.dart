import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(),
          iOptions: IOSOptions(
            accessibility: KeychainAccessibility.first_unlock,
          ),
        );

  final FlutterSecureStorage _storage;

  static const String _accessTokenKey = 'access_token';
  static const String _deviceIdKey = 'device_id';
  static const String _participantNameKey = 'participant_name';
  static const String _congressNameKey = 'congress_name';

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

  Future<void> saveParticipantName(String name) async {
    await _storage.write(key: _participantNameKey, value: name);
  }

  Future<String?> getParticipantName() async {
    return await _storage.read(key: _participantNameKey);
  }

  Future<void> deleteParticipantName() async {
    await _storage.delete(key: _participantNameKey);
  }

  Future<void> saveCongressName(String name) async {
    await _storage.write(key: _congressNameKey, value: name);
  }

  Future<String?> getCongressName() async {
    return await _storage.read(key: _congressNameKey);
  }

  Future<void> deleteCongressName() async {
    await _storage.delete(key: _congressNameKey);
  }

  Future<void> deleteAll() async {
    await _storage.deleteAll();
  }
}

