import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'secure_storage_service.dart';

/// Uygulama boyunca TEK bir SecureStorageService ornegi - her yer ayri ayri
/// `SecureStorageService()` olusturmaz.
final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});
