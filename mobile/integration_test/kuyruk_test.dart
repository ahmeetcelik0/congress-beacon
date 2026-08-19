import 'package:beacon/core/config/app_config.dart';
import 'package:beacon/core/testing/widget_keys.dart';
import 'package:beacon/features/observations/data/sqlite_observation_queue_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';

import 'test_helpers.dart';

/// Faz 8'in EN KRITIK testi - `cevrimdisi_test.dart` gibi UC AYRI
/// `flutter test` calistirmasi olarak tasarlanmistir, TEK bir calistirmada
/// OTOMATIK zincirlenmez (backend'i durdurmak/baslatmak SIZIN elinizle
/// yaptiginiz bir islem, `flutter test`in HER cagrisi da GERCEK bir
/// "uygulamayi kapat-ac" anlamina gelir - integration_test cihazda YENI bir
/// surec baslatir, bkz. `test_helpers.dart` basindaki `--no-uninstall` notu):
///
/// ```
/// # 0) Backend ACIKKEN - onceden bir GECERLI oturum/onbellek olusturur
/// #    (cevrimdisi_test.dart FAZ 1 zaten calistirdiysaniz bu adimi
/// #    ATLAYABILIRSINIZ, AYNI onbellegi kullanir):
/// flutter test integration_test/kuyruk_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "FAZ 0"
///
/// # 1) Backend'i durdurun. Beacon YAYIN YAPMAYA devam etmeli (telefonu
/// #    beacon yaninda tutun) - asagidaki test 90 saniye bekleyip kuyruga
/// #    gercekten gozlem eklendigini dogrular:
/// flutter test integration_test/kuyruk_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "FAZ 1"
///
/// # 2) Backend HALA KAPALIYKEN, ayni komutu TEKRAR calistirin (bu, cihazda
/// #    YENI bir surec baslatir - gercek "kapat-ac" ile ES DEGERDIR). Kuyugun
/// #    ONCEKI surecten KALICI oldugunu (SQLite dosyasindan okundugunu)
/// #    dogrular - Faz 8'in ASIL KANITI budur:
/// flutter test integration_test/kuyruk_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "FAZ 2"
///
/// # 3) Backend HALA KAPALIYKEN baslatin - test calisirken (60-120 saniye
/// #    icinde) SIZ backend'i tekrar baslatmalisiniz:
/// flutter test integration_test/kuyruk_test.dart -d CIHAZ_ID \
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001 \
///   --dart-define=TEST_USER_EMAIL=... --dart-define=TEST_USER_PASSWORD=... \
///   --no-uninstall --plain-name "FAZ 3"
/// ```
///
/// NOT: kuyruk sayisi, calisan uygulamanin YAZDIGI AYNI SQLite dosyasi
/// dogrudan `SqliteObservationQueueStore()` (yol override'i OLMADAN,
/// uretimdeki ile AYNI varsayilan yol) ile okunarak dogrulanir - tipki
/// `cevrimdisi_test.dart`in `SecureStorageService()`/onbellek dosyasini
/// DOGRUDAN okumasi gibi.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'FAZ 0 (backend ACIK): normal calisirken kuyruk zamaninda bosaltilir',
    (tester) async {
      await loginAndReachHome(tester);
      expect(
        find.byKey(WidgetKeys.offlineBanner),
        findsNothing,
        reason: 'Backend acikken "Çevrimdışı" seridi GORUNMEMELI.',
      );

      final store = SqliteObservationQueueStore();

      // Beacon yaninda bir sure bekle - hem tampon/kalici kuyruk yazimi
      // (bkz. BeaconObservationService._flushWriteBuffer) hem de basarili
      // gonderim/silme (bkz. _drainQueue) devrede oldugu icin, backend
      // ACIKKEN kuyruk BUYUK bir yigin OLUSTURMADAN akip gitmeli.
      final deadline = DateTime.now().add(const Duration(seconds: 30));
      while (DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(seconds: 2));
      }

      final count = await store.count();
      expect(
        count,
        lessThan(50),
        reason:
            'Backend acikken kuyrukta beklenmedik sekilde $count kayit '
            'birikti - gonderim/silme dongusu (_drainQueue) calismiyor '
            'olabilir.',
      );
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );

  testWidgets(
    'FAZ 1 (backend KAPALI olmali): kuyruga gozlem birikir',
    (tester) async {
      await loginAndReachHome(tester);
      expect(
        find.byKey(WidgetKeys.offlineBanner),
        findsOneWidget,
        reason:
            'Bu FAZ backend GERCEKTEN kapaliyken calistirilmali (bkz. dosya '
            'basindaki kullanim ornegi adim 1).',
      );

      final store = SqliteObservationQueueStore();
      final before = await store.count();

      // Beacon yaninda 90 saniye bekle - Faz 6 olcumune gore (~3.3
      // gozlem/sn) bu sure icinde onlarca kayit birikmis olmali.
      final deadline = DateTime.now().add(const Duration(seconds: 90));
      while (DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(seconds: 2));
      }

      final after = await store.count();
      expect(
        after,
        greaterThan(before),
        reason:
            '90 saniyede kalici kuyruga HIC gozlem eklenmedi (once: '
            '$before, sonra: $after) - cihaz beacon yaninda mi, Bluetooth '
            'acik mi kontrol edin.',
      );
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );

  testWidgets(
    'FAZ 2 (yeniden acilis, backend HALA KAPALI): kuyruk KORUNMUS olmali',
    (tester) async {
      // KRITIK KANIT: uygulamanin widget agaci HENUZ pompalanmadan (yani
      // "uygulama henuz acilmadan") ONCE, ONCEKI surecten (FAZ 1) kalan
      // SQLite dosyasi dogrudan okunur - bu sayi, uygulama tamamen kapanip
      // (surec sonlanip) yeniden acilsa bile kuyugun DISKTE hayatta
      // kaldigini kanitlar.
      final store = SqliteObservationQueueStore();
      final countBeforeAppStarts = await store.count();
      expect(
        countBeforeAppStarts,
        greaterThan(0),
        reason:
            'Uygulama bu surecte HENUZ ACILMADAN once bile kuyruk bos '
            '(FAZ 1 gercekten calisip veri biriktirmis mi kontrol edin - '
            'flutter test HER cagrida cihazda YENI bir surec baslatir, '
            'tipki gercek "uygulamayi kapat-ac" gibi).',
      );

      await loginAndReachHome(tester);
      expect(
        find.byKey(WidgetKeys.offlineBanner),
        findsOneWidget,
        reason: 'Bu FAZ backend HALA kapaliyken calistirilmali.',
      );

      final countAfterAppStarts = await store.count();
      expect(
        countAfterAppStarts,
        greaterThanOrEqualTo(countBeforeAppStarts),
        reason:
            'Uygulama yeniden acilirken kuyruktaki kayitlar KAYBOLMUS '
            '(once: $countBeforeAppStarts, sonra: $countAfterAppStarts) - '
            'Faz 8in KRITIK kanitidir, bu basarisizlik kalici kuyrugun '
            'calismadigini gosterir.',
      );
    },
    timeout: const Timeout(Duration(minutes: 1)),
  );

  testWidgets(
    'FAZ 3 (backend ACILIYOR): kuyruk kademeli bosalir',
    (tester) async {
      await loginAndReachHome(tester);
      expect(
        find.byKey(WidgetKeys.offlineBanner),
        findsOneWidget,
        reason:
            'Bu FAZ backend HALA kapaliyken baslamali (test SIRASINDA siz '
            'acacaksiniz - bkz. dosya basindaki kullanim ornegi adim 3).',
      );

      final store = SqliteObservationQueueStore();
      final countAtStart = await store.count();
      expect(
        countAtStart,
        greaterThan(0),
        reason:
            'Kuyruk zaten bos - onceki FAZ 1/FAZ 2 calismis mi kontrol edin.',
      );

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

      // Uygulama arka plandan on plana geldi gibi davran - hem oturumun
      // (bkz. cevrimdisi_test.dart "ag donunce") hem de kuyugun ayni anda
      // tazelendigini gozlemlemek icin (BeaconObservationService'in kendi
      // _batchTimer'i zaten bagimsiz calisir, bu sadece gercekci bir
      // senaryo olusturur).
      WidgetsBinding.instance.handleAppLifecycleStateChanged(
        AppLifecycleState.inactive,
      );
      WidgetsBinding.instance.handleAppLifecycleStateChanged(
        AppLifecycleState.resumed,
      );

      final deadline = DateTime.now().add(const Duration(seconds: 60));
      var reachedZero = false;
      while (DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(seconds: 2));
        if (await store.count() == 0) {
          reachedZero = true;
          break;
        }
      }

      expect(
        reachedZero,
        isTrue,
        reason:
            'Backend acildiktan sonra 60 saniye icinde kuyruk BOSALMADI '
            '(baslangic: $countAtStart kayit) - kademeli bosaltma '
            '(_drainQueue) calismiyor olabilir.',
      );
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );
}
