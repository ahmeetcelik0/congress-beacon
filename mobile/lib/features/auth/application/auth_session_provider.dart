import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_client_provider.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../models/auth_models.dart';
import '../data/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider));
});

/// Uygulamanın TEK oturum doğruluk kaynağı. `null` = giriş yapılmamış.
/// Yerel token'a KÖRÜ KÖRÜNE güvenilmez (bkz. Faz 6 talimatı §5) - her
/// `build()`/`refresh()` gerçekten `/auth/me`yi çağırıp sunucudaki güncel
/// durumu (token iptal edilmiş mi, şifre değişikliği gerekiyor mu, aktif
/// kongre ne) doğrular.
class AuthSessionNotifier extends AsyncNotifier<MeResponse?> {
  @override
  Future<MeResponse?> build() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();
    if (token == null) return null;

    try {
      final me = await ref.read(authRepositoryProvider).me();
      if (me.activeCongressId != null) {
        await storage.saveActiveCongressId(me.activeCongressId!);
      }
      return me;
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        // 401 = gercekten giris yapilmamis - bu bir HATA degil, normal
        // "oturum yok" durumudur (AsyncData(null)).
        await storage.clearSession();
        return null;
      }
      // Diger hatalarda (ag kopuklugu vb.) oturumu SILMIYORUZ - kullanici
      // internetsizken uygulamayi actiginda giris ekranina dusup token'ini
      // kaybetmesin. AsyncError olarak yukari tasinir, SplashPage "tekrar
      // dene" secenegi gosterir, bir sonraki refresh'te tekrar denenir.
      rethrow;
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading<MeResponse?>();
    state = await AsyncValue.guard(() => build());
  }

  /// Basarili login/select-congress/change-password sonrasi cagrilir - YENI
  /// token kaydedilip oturum /auth/me ile tazelenir.
  Future<void> applyNewToken(String accessToken) async {
    await ref.read(secureStorageProvider).saveAccessToken(accessToken);
    await refresh();
  }

  Future<void> logout() async {
    await ref.read(secureStorageProvider).clearSession();
    state = const AsyncData(null);
  }
}

final authSessionProvider =
    AsyncNotifierProvider<AuthSessionNotifier, MeResponse?>(
      AuthSessionNotifier.new,
    );
