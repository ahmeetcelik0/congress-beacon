import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/auth_session_provider.dart';
import 'api_client.dart';

/// Uygulama boyunca TEK bir ApiClient örneği - 401 yakalayıcı tek burada
/// bağlanır (bkz. Faz 6 talimatı §2). `ref.read` kapanış (closure) içinde
/// olduğu için burada döngüsel bir bağımlılık OLUŞMAZ: yalnızca 401
/// GERÇEKTEN alındığında çalışır, provider'ın kendi kuruluşu sırasında değil.
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient();
  client.onUnauthorized = () {
    ref.read(authSessionProvider.notifier).logout();
  };
  return client;
});
