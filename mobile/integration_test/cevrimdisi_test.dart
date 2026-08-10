import 'dart:io';

import 'package:beacon/core/storage/secure_storage_service.dart';
import 'package:beacon/core/testing/widget_keys.dart';
import 'package:beacon/core/widgets/async_content_view.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:path_provider/path_provider.dart';

import 'test_helpers.dart';

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
///   --plain-name "FAZ 1"
///
/// # 2) Simdi backend'i durdurun (Ctrl+C / docker compose stop vb.) -
/// #    ucak modu GEREKMEZ, backend'in gercekten KAPALI olmasi yeterli.
///
/// flutter test integration_test/cevrimdisi_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --plain-name "FAZ 2"
/// ```
///
/// ONEMLI NOT - bu test asagidaki mimari sinirin TAM OLARAK uzerinde
/// calisir: `AuthSessionNotifier.build()` (bkz. `auth_session_provider.dart`)
/// yerel bir `MeResponse` onbellegi TUTMAZ - her taze surecte (integration_test
/// her `flutter test` cagrisinda YENI bir Dart sureci baslatir) `/auth/me`ye
/// GERCEKTEN erismesi gerekir; basarisiz olursa oturum SILINMEZ ama
/// `AsyncError`a duser ve `route_redirect.dart` kullaniciyi Splash'teki
/// "Sunucuya bağlanılamadı" ekraninda TUTAR - Program ekranina (ve onun
/// KALICI onbellek okuma mantigina) HIC ULASILAMAZ. FAZ 2 bu yuzden asil
/// olarak SUNU sinar: uygulamanin genel oturum dogrulama kapisi, Program
/// ekraninin cevrimdisi onbellek yetenegini GOLGELIYOR MU?
///
/// `loginAndReachHome` bu ekrani gorunce Splash'in kendi "Tekrar Dene"
/// dugmesine birkac kez basar (gercek cihazda taze bir surecin agdan
/// sorumlu katmaninin ilk saniyelerde henuz hazir OLMAYABILDIGI, gecici
/// bir baslangic yarisini tolere etmek icin - bkz. `pumpUntilFound`
/// yorumu). FAZ 2'de backend GERCEKTEN kapaliyken bu denemeler hicbir
/// zaman basarili olmaz ve 30 saniyelik genel sinirda `loginAndReachHome`
/// retryTapCount > 0 ile FAIL olur - bu bir TEST YAZIM HATASI DEGIL,
/// gercek bir mimari bulgudur (bkz. bu dosyanin ekiyle birlikte verilen
/// rapor); bu fazda test GEVSETILEREK gecirilmez.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'FAZ 1 (backend ACIK): program yuklenir, kalici onbellek dosyaya yazilir',
    (tester) async {
      await loginAndReachHome(tester);
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
      final label = tester.widget<StalenessLabel>(find.byType(StalenessLabel));
      expect(
        label.hasStaleError,
        isFalse,
        reason:
            'Backend acikken ilk yuklemede StalenessLabel "cevrimdisi" '
            'gostermemeli - agdan taze veri beklenir.',
      );

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
    },
  );

  testWidgets(
    'FAZ 2 (backend KAPALI - FAZ 1den SONRA elle durdurulmus olmali): '
    'program onbellekten gosterilir, hata ekranina DUSMEZ',
    (tester) async {
      await loginAndReachHome(tester);
      await switchToTab(
        tester,
        WidgetKeys.shellTabProgram,
        find.byKey(WidgetKeys.programSearchField),
      );

      await pumpUntilFound(tester, find.byType(StalenessLabel));
      final label = tester.widget<StalenessLabel>(find.byType(StalenessLabel));
      expect(
        label.hasStaleError,
        isTrue,
        reason:
            'Backend kapaliyken StalenessLabel "cevrimdisi" GOSTERMELI - '
            'eger false ise ya backend hala erisilebilir (FAZ 2yi '
            'calistirmadan once gercekten durdurun) ya da tazelik '
            'bilgisi yanlis hesaplaniyor.',
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
    },
  );
}
