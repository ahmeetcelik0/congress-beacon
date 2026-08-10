import 'dart:convert';
import 'dart:io';

import 'package:beacon/core/config/app_config.dart';
import 'package:beacon/core/storage/secure_storage_service.dart';
import 'package:beacon/core/testing/widget_keys.dart';
import 'package:beacon/core/widgets/async_content_view.dart';
import 'package:beacon/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:path_provider/path_provider.dart';

import 'test_helpers.dart';

/// `checkJwtExpiry`nin cozebilecegi, GERCEKCI (dolgusuz base64url) ama
/// SAHTE bir JWT uretir - imza dogrulamasi YAPILMADIGI icin (bkz.
/// `jwt_expiry.dart` guvenlik gerekcesi) gercek bir imza gerekmez.
String _fakeJwt(Map<String, dynamic> payload) {
  String segment(Map<String, dynamic> json) =>
      base64Url.encode(utf8.encode(jsonEncode(json))).replaceAll('=', '');
  final header = segment({'alg': 'HS256', 'typ': 'JWT'});
  final body = segment(payload);
  return '$header.$body.sahte-imza';
}

/// Faz 7'nin EN KRITIK testi - iki AYRI `flutter test` calistirmasi olarak
/// tasarlanmistir, TEK bir calistirmada OTOMATIK zincirlenmez (backend'i
/// durdurmak/baslatmak bu test surecinin DISINDA, sizin elinizle yaptiginiz
/// bir islem):
///
/// ```
/// # 1) Backend AYAKTA iken:
/// flutter test integration_test/cevrimdisi_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "FAZ 1"
///
/// # 2) Simdi backend'i durdurun (Ctrl+C / docker compose stop vb.) -
/// #    ucak modu GEREKMEZ, backend'in gercekten KAPALI olmasi yeterli.
///
/// flutter test integration_test/cevrimdisi_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "backend KAPALI"
///
/// # 3) Backend HALA KAPALIYKEN baslatin - test calisirken (60-120 saniye
/// #    icinde) SIZ backend'i tekrar baslatmalisiniz, test bunu polling
/// #    ile bekler ve uygulamanin resume oldugunda kendini otomatik
/// #    tazeledigini dogrular:
///
/// flutter test integration_test/cevrimdisi_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "ag donunce"
/// ```
///
/// **Faz 7.1 ile bu test artik GECMELIDIR.** `AuthSessionNotifier` (bkz.
/// `auth_session_provider.dart`) artik agsizken (401 DEGIL - `SocketException`
/// gibi genuine bir baglanti hatasi) saklanan token'in `exp`i YEREL olarak
/// hala gecerliyse VE daha once basarili bir `/auth/me` yaniti onbellekte
/// varsa, o yanit gosterilir - Program ekraninin KALICI onbellek okuma
/// mantigina boylece ULASILABILIR. FAZ 2 basarisiz olursa (ör.
/// `loginAndReachHome` "Sunucuya bağlanılamadı"nda takili kalirsa) bu bir
/// GERCEK REGRESYONDUR, test yazim hatasi degil.
///
/// NOT: `StalenessLabel.hasStaleError`in KENDISI bu testte KULLANILMAZ -
/// `CachedContentNotifier._load()` ag hatasinda onbellege SESSIZCE (hatayi
/// tekrar FIRLATMADAN) duser, yani o provider'in `AsyncValue.hasError`i
/// HICBIR ZAMAN true olmaz (bu, Faz 7'nin kendi onceden var olan bir
/// davranisidir, Faz 7.1 kapsaminda DEGISTIRILMEDI). Cevrimdisi durumun
/// TEK dogruluk kaynagi `isOfflineSessionProvider`/`OfflineBanner`dir.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'FAZ 1 (backend ACIK): program yuklenir, kalici onbellek dosyaya yazilir',
    (tester) async {
      await loginAndReachHome(tester);

      // Bkz. dosya basi NOT - bu, `isOfflineSessionProvider`in ONCEKI bir
      // calistirmadan kalan bayat bir onbellek yuzunden (gecici ag yarisi +
      // `--no-uninstall` ile hayatta kalan bir onbellek) yanlislikla
      // "cevrimdisi" gostermedigini dogrular - GERCEKTEN backend acikken
      // bu serit GORUNMEMELI.
      expect(
        find.byKey(WidgetKeys.offlineBanner),
        findsNothing,
        reason:
            'Backend acikken "Çevrimdışı" seridi GORUNMEMELI - eger '
            'gorunuyorsa muhtemelen taze surecin ag katmani henuz hazir '
            'olmadan (bkz. `loginAndReachHome` yorumu) onbellek FALLBACK\'i '
            'devreye girdi.',
      );

      await switchToTab(
        tester,
        WidgetKeys.shellTabProgram,
        find.byKey(WidgetKeys.programSearchField),
      );

      // Sadece arama kutusu degil, GERCEK icerigin (StalenessLabel'in
      // builder'i cagirdigini gosteren) yuklendigini bekle - AppBar'daki
      // arama alani `AsyncContentView`in DISINDA, yukleniyor durumunda bile
      // hemen gorunur.
      await pumpUntilFound(tester, find.byType(StalenessLabel));

      final congressId = await SecureStorageService().getActiveCongressId();
      expect(
        congressId,
        isNotNull,
        reason: 'Aktif kongre ID Keychain\'e yazilmamis.',
      );

      final docsDir = await getApplicationDocumentsDirectory();
      final cacheFile = File(
        '${docsDir.path}/content_cache/program_$congressId.json',
      );
      expect(
        await cacheFile.exists(),
        isTrue,
        reason:
            'Kalici onbellek dosyasi olusmadi: ${cacheFile.path} - FAZ 2 '
            '(cevrimdisi) bu dosyaya bagimli, simdi calistirilirsa basarisiz '
            'olur.',
      );

      // Faz 7.1: `/auth/me`nin BASARILI yanitinin da yerel kopyasi
      // yazilmis olmali - FAZ 2'nin dayandigi tam olarak budur.
      final lastKnownSession = await SecureStorageService()
          .getLastKnownSession();
      expect(
        lastKnownSession,
        isNotNull,
        reason:
            'Son basarili /auth/me yaniti yerel olarak saklanmamis - FAZ 2 '
            '(cevrimdisi giris) bu olmadan calisamaz.',
      );
    },
  );

  testWidgets('backend KAPALI (FAZ 1den SONRA elle durdurulmus olmali): '
      'uygulama cevrimdisi acilir, program onbellekten gosterilir', (
    tester,
  ) async {
    await loginAndReachHome(tester);

    // ASIL KRITIK IDDIA: backend kapaliyken bile Ana Sayfa'ya ULASILDI
    // (loginAndReachHome zaten bunu garanti eder, aksi halde `fail()`
    // firlatirdi) VE "Çevrimdışı" seridi GORUNUYOR.
    expect(
      find.byKey(WidgetKeys.offlineBanner),
      findsOneWidget,
      reason:
          'Backend kapaliyken "Çevrimdışı" seridi GORUNMELI - eger '
          'gorunmuyorsa ya backend hala erisilebilir (once gercekten '
          'durdurun) ya da isOfflineSessionProvider yanlis hesaplaniyor.',
    );

    await switchToTab(
      tester,
      WidgetKeys.shellTabProgram,
      find.byKey(WidgetKeys.programSearchField),
    );

    // "Bu günde henüz oturum yok" bos-durumu DEGIL, GERCEK onbellekteki
    // oturum kartlari gorunmeli - hata ekranina (AsyncContentView'in
    // `_ErrorState`i) KESINLIKLE DUSULMEMELI.
    expect(
      find.text('Tekrar Dene'),
      findsNothing,
      reason:
          'Program ekrani hata durumuna dustu - onbellekteki veri '
          'GOSTERILEMEDI.',
    );
    final sessionCards = find.byWidgetPredicate(
      (widget) =>
          widget.key is ValueKey<String> &&
          (widget.key! as ValueKey<String>).value.startsWith(
            'program_session_card_',
          ),
    );
    expect(
      sessionCards,
      findsWidgets,
      reason:
          'Onbellekten hicbir oturum karti gosterilmedi - FAZ 1 gercekten '
          'calisip onbellegi doldurmus mu, kontrol edin.',
    );

    // Sunucu gerektiren eylem (Kongre Degistir) SESSIZCE basarisiz
    // OLMAMALI - Profilim'e gecip dokunulunca anlasilir bir mesaj
    // vermeli, /select-congress'e GITMEMELI (bkz. profile_page.dart
    // `_ActionTile.enabled`).
    await switchToTab(
      tester,
      WidgetKeys.shellTabProfile,
      find.byKey(WidgetKeys.profileChangeCongress),
    );
    await tester.tap(find.byKey(WidgetKeys.profileChangeCongress));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(
      find.text('Kongre Seçin'),
      findsNothing,
      reason:
          'Cevrimdisiyken "Kongre Değiştir"e dokunmak /select-congress '
          'ekranina GECMEMELI (sunucu gerektirir).',
    );
  });

  testWidgets(
    'backend KAPALI + suresi dolmus token: giris ekranina duser (icine '
    'ALINMAZ)',
    (tester) async {
      // Onceki testten (--no-uninstall ile) kalma GECERLI token, BILEREK
      // suresi COKTAN dolmus sahte bir token'la DEGISTIRILIR - onbellekteki
      // MeResponse DOKUNULMADAN kalir (bkz. Faz 7.1 "Alinan karar": suresi
      // dolmus token + agsiz -> giris ekranina yonlendirilir, DEGIL
      // onbellekten devam).
      //
      // ONEMLI: `--no-uninstall` ile Keychain sonraki `flutter test`
      // CALISTIRMALARINA da tasinir - bu testin sahte token'i GERCEK
      // token'in USTUNE yazip GERI YUKLEMEMESI, sonraki HER calistirmayi
      // (bu dosyanin GERI KALANI dahil) bozardı (gercek cihazda tam olarak
      // bu sekilde yakalandi - test 1 "suresi dolmus" hatasiyla basarisiz
      // olmaya basladi). `addTearDown` test basarili/basarisiz FARK
      // ETMEKSIZIN calisir.
      final storage = SecureStorageService();
      final originalToken = await storage.getAccessToken();
      addTearDown(() async {
        if (originalToken != null) {
          await storage.saveAccessToken(originalToken);
        }
      });

      final expiredToken = _fakeJwt({
        'sub': 'test-expired-subject',
        'exp':
            DateTime.now()
                .subtract(const Duration(hours: 2))
                .millisecondsSinceEpoch ~/
            1000,
      });
      await storage.saveAccessToken(expiredToken);

      await tester.pumpWidget(const ProviderScope(child: CongressBeaconApp()));

      final loginButton = find.widgetWithText(FilledButton, 'Giriş Yap');
      await pumpUntilFound(
        tester,
        loginButton,
        timeout: const Duration(seconds: 20),
      );

      expect(
        find.byKey(WidgetKeys.homeContentButtonProgram),
        findsNothing,
        reason:
            'Suresi dolmus bir token ile (agsizken) yanlislikla Ana '
            'Sayfa\'ya girilmis olabilir.',
      );
      expect(
        find.byKey(WidgetKeys.offlineBanner),
        findsNothing,
        reason:
            'Giris ekraninda "Çevrimdışı" seridi ANLAMSIZ - henuz bir '
            'oturum yok.',
      );
    },
  );

  testWidgets('ag donunce (resume) cevrimdisi serit otomatik kaybolur ve veri '
      'tazelenir', (tester) async {
    // Bu test BASLADIGINDA backend'in HALA KAPALI olmasi beklenir -
    // asagidaki polling SIRASINDA (60-120 saniye icinde) backend'i
    // tekrar baslatmaniz gerekir.
    await loginAndReachHome(tester);
    expect(find.byKey(WidgetKeys.offlineBanner), findsOneWidget);

    var backendIsUp = false;
    for (var attempt = 0; attempt < 60; attempt++) {
      try {
        final response = await http
            .get(Uri.parse('${AppConfig.apiBaseUrl}/health'))
            .timeout(const Duration(seconds: 3));
        if (response.statusCode == 200) {
          backendIsUp = true;
          break;
        }
      } catch (_) {
        // Henuz gelmedi - devam et.
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    expect(
      backendIsUp,
      isTrue,
      reason:
          'Backend 120 saniye icinde tekrar erisilir olmadi - bu testi '
          'calistirirken backend\'i baslatmayi unutmus olabilirsiniz.',
    );

    // Uygulama arka plandan ON PLANA geldi gibi davran.
    // `AppLifecycleListener.onResume`, YALNIZCA `inactive`/`detached`
    // durumundan `resumed`e GECISTE tetiklenir (bkz. Flutter SDK
    // `app_lifecycle_listener.dart`) - dogrudan resumed'dan resumed'a
    // "gecis" HICBIR SEY tetiklemez, once gecerli bir ARA duruma
    // gecilir.
    WidgetsBinding.instance.handleAppLifecycleStateChanged(
      AppLifecycleState.inactive,
    );
    WidgetsBinding.instance.handleAppLifecycleStateChanged(
      AppLifecycleState.resumed,
    );

    final deadline = DateTime.now().add(const Duration(seconds: 15));
    while (find.byKey(WidgetKeys.offlineBanner).evaluate().isNotEmpty &&
        DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 300));
    }

    expect(
      find.byKey(WidgetKeys.offlineBanner),
      findsNothing,
      reason:
          'Ag donduginde (uygulama resume oldugunda) "Çevrimdışı" seridi '
          'otomatik KALKMALI - AuthLifecycleRefreshNotifier calismiyor '
          'olabilir (bkz. auth_lifecycle_refresh_provider.dart).',
    );
  }, timeout: const Timeout(Duration(minutes: 3)));
}
