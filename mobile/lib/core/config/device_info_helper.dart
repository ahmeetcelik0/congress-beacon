import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';

/// `POST /devices/register`'ın `deviceModel`/`osVersion` alanları için ham
/// cihaz bilgisi - iki platformu tek bir çağrı arkasında birleştirir.
class DeviceInfoSnapshot {
  const DeviceInfoSnapshot({required this.model, required this.osVersion});

  final String? model;
  final String? osVersion;
}

Future<DeviceInfoSnapshot> collectDeviceInfo() async {
  final plugin = DeviceInfoPlugin();
  try {
    if (Platform.isIOS) {
      final info = await plugin.iosInfo;
      return DeviceInfoSnapshot(
        model: info.modelName,
        osVersion: 'iOS ${info.systemVersion}',
      );
    }
    if (Platform.isAndroid) {
      final info = await plugin.androidInfo;
      return DeviceInfoSnapshot(
        model: info.model,
        osVersion: 'Android ${info.version.release}',
      );
    }
  } catch (_) {
    // Cihaz bilgisi alinamazsa kayit yine de devam eder (alanlar opsiyonel).
  }
  return const DeviceInfoSnapshot(model: null, osVersion: null);
}
