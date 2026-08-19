import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Gercek uygulama surumu - `beacon_observation_service.dart`taki eskiden
/// sabit yazili '1.0.0' degerinin yerini alir (bkz. Faz 6 talimati §1).
/// Riverpod bir FutureProvider'i otomatik olarak onbelleklediginden platform
/// kanali yalnizca bir kez sorgulanir.
final packageInfoProvider = FutureProvider<PackageInfo>((ref) {
  return PackageInfo.fromPlatform();
});
