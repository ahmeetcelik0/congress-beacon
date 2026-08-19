import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/jwt_expiry.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_client_provider.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../models/auth_models.dart';
import '../data/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider));
});

/// Su an gosterilen oturumun AGDAN degil, cevrimdisi yerel onbellekten
/// geldigini isaretler (bkz. Faz 7.1 talimati). `AuthSessionNotifier`
/// tarafindan yan etki olarak guncellenir; kabuktaki "Cevrimdisi" seridi
/// VE sunucu gerektiren eylemler (Kongre Degistir, Sifre Degistir) bunu
/// izler. `MeResponse`in kendi tipini DEGISTIRMEDEN (uygulama genelinde
/// `authSessionProvider.value?.xxx` kullanan cok sayida yer var) ayri bir
/// bayrak olarak tutulmasinin sebebi budur. Riverpod 3'te `StateProvider`
/// artik "legacy" API oldugu icin (bkz. `package:flutter_riverpod/
/// legacy.dart`), projenin geri kalaninda zaten kullanilan `Notifier`
/// deseniyle (bkz. `PermissionGateNotifier`) tutarli kalinir.
class IsOfflineSessionNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void setOffline(bool value) {
    if (state != value) state = value;
  }
}

final isOfflineSessionProvider =
    NotifierProvider<IsOfflineSessionNotifier, bool>(
      IsOfflineSessionNotifier.new,
    );

/// Faz 8: `AuthSessionNotifier.logout()` kullanici ACIKCA "Cikis Yap"
/// bastiginda `true`ya cekilir - `ObservationLifecycleNotifier` bunu
/// KAPSAM DEGISIMI (kalici gozlem kuyrugunu tamamen temizleme) sinyali
/// olarak okuyup hemen sifirlar (`consume()`). 401 / yerel token suresi
/// dolmus gibi ISTEMSIZ oturum dususlerinde BILEREK ayarlanmaz - aksi halde
/// kullanici agsizken token'i suresi dolup zorla giris ekranina dustugunde,
/// AYNI hesapla tekrar giris yaptiginda saatlerdir biriken kuyruk sessizce
/// silinirdi (bkz. docs/decisions.md "Faz 8" - bu, projenin "katilim
/// verisini eksiksiz toplama" temel amaciyla dogrudan celisirdi).
class ExplicitLogoutSignalNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void markLoggedOut() => state = true;

  void consume() => state = false;
}

final explicitLogoutSignalProvider =
    NotifierProvider<ExplicitLogoutSignalNotifier, bool>(
      ExplicitLogoutSignalNotifier.new,
    );

/// Cevrimdisi girisin NEDEN engellendigini SplashPage'e tasir - genel
/// "Sunucuya bağlanılamadı" mesaji yerine, onbellekte gecerli bir oturum
/// VARKEN ozellikle bu iki durumda (sunucu gerektirdikleri icin cevrimdisi
/// acilamazlar) daha anlasilir bir mesaj gosterilebilsin diye (bkz. Faz
/// 7.1 talimati §3 "Bu durumda Splash'te anlasilir bir mesajla kal").
enum OfflineBlockReason { passwordChangeRequired, noActiveCongress }

class OfflineBlockReasonNotifier extends Notifier<OfflineBlockReason?> {
  @override
  OfflineBlockReason? build() => null;

  void set(OfflineBlockReason? value) => state = value;
}

final offlineBlockReasonProvider =
    NotifierProvider<OfflineBlockReasonNotifier, OfflineBlockReason?>(
      OfflineBlockReasonNotifier.new,
    );

/// Uygulamanın TEK oturum doğruluk kaynağı. `null` = giriş yapılmamış.
/// Yerel token'a KÖRÜ KÖRÜNE güvenilmez (bkz. Faz 6 talimatı §5) - her
/// `build()`/`refresh()` gerçekten `/auth/me`yi çağırıp sunucudaki güncel
/// durumu (token iptal edilmiş mi, şifre değişikliği gerekiyor mu, aktif
/// kongre ne) doğrular.
///
/// **Faz 7.1 - cevrimdisi soguk baslangic:** `/auth/me` AG HATASIYLA
/// basarisiz olursa (401 DEGIL - sunucu hic cevap vermedi/ulasilamadi),
/// saklanan token'in `exp`i YEREL olarak KONTROL edilir:
/// - **Gecerli** VE onbellekte basarili bir `/auth/me` yaniti varsa, o
///   yanit gosterilir (cevrimdisi mod).
/// - **Suresi dolmus** ise oturum SILINIR, kullanici giris ekranini gorur
///   (agsizken sonsuz "tekrar dene" dongusune sokmak yerine).
/// - **Cozumlenemedi** (bozuk token) ise ne gecerli ne suresi dolmus
///   SAYILMAZ - genel ag hatasi akisina (Splash "tekrar dene") dusulur.
///
/// Bu bir "canli dogrulamayi atlama" degildir - ag DONDUGUNDE ayni
/// `build()`/`refresh()` yolu yine GERCEK `/auth/me`yi cagirir; yerel
/// `exp` kontrolu yalnizca agsizken "bu onbellegi göstermek/oturumu
/// düşürmek makul mu" sorusuna cevap verir (guvenlik gerekcesi icin bkz.
/// `jwt_expiry.dart` ve `docs/decisions.md` "Faz 7.1").
class AuthSessionNotifier extends AsyncNotifier<MeResponse?> {
  @override
  Future<MeResponse?> build() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();

    // Her `build()` denemesi kendi sonucuna gore bu ikisini YENIDEN
    // belirler - onceki bir denemeden kalma bayat bir deger asla ELDE
    // KALMAZ (ör. bir onceki calistirmada mustChangePassword engeli
    // gosterildi ama BU calistirmada onbellek hic yoksa, eski neden
    // yanlislikla gorunmeye devam etmemeli).
    //
    // BILEREK ilk `await`DAN SONRA yapilir, fonksiyonun EN BASINDA DEGIL:
    // `build()`in KENDISI HENUZ senkron olarak calisirken (ilk `await`e
    // ULASMADAN) BASKA bir provider'i (`offlineBlockReasonProvider`) IÇIN
    // ONA-DA-`ref.read` cagirmak, o provider TAZE bir surecte ILK KEZ
    // okunuyorsa Riverpod'un kendisini SENKRON olarak insa etmesini
    // GEREKTIRIR - bu, "bir provider baska birinin insaasi SURERKEN
    // insa edilemez" guvenlik denetimini (Riverpod framework assertion'i,
    // `_debugCurrentlyBuildingElement`) tetikleyip GERCEK CIHAZDA
    // yakalanan bir hataya yol aciyordu (bkz. Faz 7.1 talimati
    // `cevrimdisi_test.dart` "suresi dolmus token" senaryosu ile
    // bulundu). Ilk `await` bu senkron pencereyi KAPATIR.
    ref.read(offlineBlockReasonProvider.notifier).set(null);

    if (token == null) {
      ref.read(isOfflineSessionProvider.notifier).setOffline(false);
      return null;
    }

    try {
      final me = await ref.read(authRepositoryProvider).me();
      if (me.activeCongressId != null) {
        await storage.saveActiveCongressId(me.activeCongressId!);
      }
      await storage.saveLastKnownSession(me);
      ref.read(isOfflineSessionProvider.notifier).setOffline(false);
      return me;
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        // 401 = gercekten giris yapilmamis - bu bir HATA degil, normal
        // "oturum yok" durumudur (AsyncData(null)).
        await storage.clearSession();
        ref.read(isOfflineSessionProvider.notifier).setOffline(false);
        return null;
      }

      // `statusCode == null` yalnizca AG SEVIYESINDE basarisizlikta olusur
      // (bkz. `ApiClient.get` - `SocketException`/`ClientException`/zaman
      // asimi hicbir HTTP durum kodu URETMEZ). Sunucudan gelen 403/500 gibi
      // GERCEK bir yanit varsa (statusCode dolu) bu cevrimdisi bir durum
      // DEGILDIR, normal hata akisina (asagidaki rethrow) birakilir.
      if (e.statusCode == null) {
        final localTokenStatus = checkJwtExpiry(token);

        // Faz 7.1 "Alinan karar": token'in kendisi YEREL olarak KESIN
        // suresi dolmussa, agsizken sonsuza kadar Splash'in "tekrar dene"
        // dongusune sokmak yerine GERCEKTEN oturum yokmus gibi ele alinir
        // - kullanici giris ekranini gorur (bkz. `route_redirect.dart`
        // `!isAuthenticated -> /login`). `undecodable` (bozuk token) BU
        // DALA GIRMEZ - yalnizca KESIN olarak cozumlenip suresi dolmus
        // bulunan token icin geçerli, cunku cozumlenemeyen bir token
        // hakkinda "suresi dolmus" YARGISI vermek yanlis olur.
        if (localTokenStatus == JwtStatus.expired) {
          await storage.clearSession();
          ref.read(isOfflineSessionProvider.notifier).setOffline(false);
          return null;
        }

        if (localTokenStatus == JwtStatus.valid) {
          final fallback = await _tryOfflineFallback(storage, token);
          if (fallback != null) {
            ref.read(isOfflineSessionProvider.notifier).setOffline(true);
            return fallback;
          }
        }
      }

      // Diger hatalarda (ag kopuklugu + gecerli bir onbellek YOKSA, ya da
      // token cozumlenemedi/mustChangePassword-kongre engeli varsa) oturumu
      // SILMIYORUZ - kullanici internetsizken uygulamayi actiginda giris
      // ekranina dusup token'ini kaybetmesin. AsyncError olarak yukari
      // tasinir, SplashPage "tekrar dene" secenegi gosterir, bir sonraki
      // refresh'te tekrar denenir (ag donduğunde gercek `/auth/me`ye gecer).
      ref.read(isOfflineSessionProvider.notifier).setOffline(false);
      rethrow;
    }
  }

  /// `null` doner = cevrimdisi ACILAMAZ, cagiran taraf mevcut hata akisina
  /// (Splash "tekrar dene") devam eder. Butun kosullar KESIN olmali - bir
  /// tanesi bile eksikse cevrimdisi ACILMAZ (bkz. Faz 7.1 talimati §3:
  /// "mustChangePassword true olan kullanici / aktif kongre secilmemisse
  /// cevrimdisi iceri alinmamali", ikisi de sunucu gerektiren durumlar).
  /// Bu iki durumda `offlineBlockReasonProvider` da ayarlanir ki Splash
  /// genel "Sunucuya bağlanılamadı" yerine ozel bir mesaj gosterebilsin.
  /// NOT: token'in `exp` kontrolu cagiran tarafta (`build()`) YAPILDI -
  /// buraya yalnizca YEREL olarak GECERLI bulunan bir token icin girilir.
  Future<MeResponse?> _tryOfflineFallback(
    SecureStorageService storage,
    String token,
  ) async {
    final cached = await storage.getLastKnownSession();
    if (cached == null) return null;

    // Savunma amacli ikinci katman - normal akiste token ve onbellek HER
    // ZAMAN birlikte yazilir (bkz. yukaridaki basarili dal), ama farkli bir
    // hesaba ait bir onbellegin YANLISLIKLA kullanilmasi asla olmamali.
    final cachedUserId = await storage.getLastKnownSessionUserId();
    final tokenSubject = extractJwtSubject(token);
    if (cachedUserId == null ||
        tokenSubject == null ||
        cachedUserId != tokenSubject) {
      return null;
    }

    if (cached.mustChangePassword) {
      ref
          .read(offlineBlockReasonProvider.notifier)
          .set(OfflineBlockReason.passwordChangeRequired);
      return null;
    }
    if (cached.activeCongressId == null) {
      ref
          .read(offlineBlockReasonProvider.notifier)
          .set(OfflineBlockReason.noActiveCongress);
      return null;
    }

    return cached;
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
    ref.read(isOfflineSessionProvider.notifier).setOffline(false);
    ref.read(explicitLogoutSignalProvider.notifier).markLoggedOut();
    state = const AsyncData(null);
  }
}

final authSessionProvider =
    AsyncNotifierProvider<AuthSessionNotifier, MeResponse?>(
      AuthSessionNotifier.new,
    );

/// `OfflineBanner`in "Son bağlantı: ..." metni icin - onbellekteki
/// `MeResponse`in NE ZAMAN yazildigini okur (bkz. `SecureStorageService.
/// saveLastKnownSession`). `autoDispose`: yalnizca serit gorunurken
/// (yani cevrimdisiyken) izlenir, gereksiz yere bellekte kalmaz.
final lastKnownSessionCachedAtProvider = FutureProvider.autoDispose<DateTime?>((
  ref,
) {
  return ref.watch(secureStorageProvider).getLastKnownSessionCachedAt();
});
