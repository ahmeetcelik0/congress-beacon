import 'package:beacon/core/testing/widget_keys.dart';
import 'package:beacon/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Test kullanicisi bilgileri KOD ICINE YAZILMAZ - komut satirindan
/// `--dart-define` ile verilir (bkz. Faz 7 XCUITest -> integration_test
/// gecis talimati). `API_BASE_URL` zaten ayni yontemle veriliyordu
/// (`AppConfig`), buradaki iki alan da ayni deseni izler.
///
/// Kullanim ornegi:
/// ```
/// flutter test integration_test/navigasyon_test.dart -d CIHAZ_ID
///   --dart-define=API_BASE_URL=http://BILGISAYAR_IP:3001
///   --dart-define=TEST_USER_EMAIL=faz1-test@example.com
///   --dart-define=TEST_USER_PASSWORD=GERCEK_SIFRE
///   --dart-define=TEST_CONGRESS_NAME=Test
///   --no-uninstall
/// ```
///
/// `--no-uninstall` ONEMLI: `flutter test` gercek iOS cihazlarda
/// integration_test'i VARSAYILAN olarak her calistirmadan SONRA
/// uygulamayi CIHAZDAN SILER (bkz. `flutter test --help --verbose` ->
/// `--[no-]uninstall`, varsayilan ACIK). Bu, HER calistirmada Keychain
/// oturumunu VE konum iznini SIFIRLAR - konum izni NATIVE bir sistem
/// diyalogudur, `integration_test` widget agacindan ONA DOKUNAMAZ, bu
/// yuzden silinen bir uygulama bir sonraki calistirmada `/permission`
/// ekraninda TAKILI kalir. `--no-uninstall` ile uygulama cihazda kalir;
/// konum izni BIR KEZ elle "Her Zaman Izin Ver" olarak verildikten sonra
/// (Ayarlar > Gizlilik ve Guvenlik > Konum Servisleri > uygulama adi)
/// TUM sonraki calistirmalarda kalici olur.
const testUserEmail = String.fromEnvironment('TEST_USER_EMAIL');
const testUserPassword = String.fromEnvironment('TEST_USER_PASSWORD');
const testCongressName = String.fromEnvironment(
  'TEST_CONGRESS_NAME',
  defaultValue: 'Test',
);

/// `finder` ekranda GORUNENE kadar sinirli araliklarla `pump` cagirir.
/// `pumpAndSettle` YERINE bunun kullanilma sebebi: Splash ve yukleniyor
/// ekranlarindaki surekli donen `CircularProgressIndicator` her karede
/// yeni bir animasyon karesi zamanliyor - `pumpAndSettle` bu yuzden
/// "hicbir zaman sakinlesmiyor" saniyor ve kendi ic zaman asimina kadar
/// (varsayilan 10 dk) bosuna bekliyor. Burada agac GERCEKTEN beklenen
/// duruma ULASTIGINDA donulur, spinner donmeye devam etse bile.
Future<void> pumpUntilFound(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (finder.evaluate().isEmpty) {
    if (DateTime.now().isAfter(deadline)) {
      fail('Zaman asimi: "$finder" $timeout icinde ekranda bulunamadi.');
    }
    await tester.pump(const Duration(milliseconds: 250));
  }
  // `finder` agacta BELIRDI ama sayfa GECIS ANIMASYONU (ör. `pageBack()`
  // sonrasi geri kayma) hala SURUYOR olabilir - widget bulunur bulunmaz
  // hemen ona dokunmak, transisyon bitmeden hesaplanan GECICI (ekran
  // disina tasan) bir merkez noktasina isabet edip "did not hit test"
  // hatasi verebilir (gercek cihazda yakalandi). Standart Material
  // gecis suresini (~300ms) asan bir tampon ile bekleyip agirlikli
  // animasyonun oturmasi saglanir.
  await tester.pump(const Duration(milliseconds: 400));
}

/// Uygulamayi baslatir ve Ana Sayfa'ya ULASANA kadar gerekli adimlari
/// (giris + kongre secimi) otomatik yurutur. Uygulamanin HANGI durumdan
/// basladigindan BAGIMSIZ calisir: gercek cihazda `flutter_secure_storage`
/// (iOS Keychain) onceki bir test/manuel oturumdan kalma bir token
/// tasiyor olabilir - bu durumda giris/kongre secimi ekranlari hic
/// GORUNMEZ ve fonksiyon doğrudan Ana Sayfa'yi bulup doner.
///
/// NOT: Konum izninin bu cihazda ZATEN "Her Zaman Izin Ver" ile verilmis
/// olmasi VARSAYILIR (bkz. Faz 6/6.2 gercek cihaz dogrulamasi) - izin
/// ekrani (`/permission`) bu fonksiyon tarafindan ELE ALINMAZ, cunku izin
/// diyalogu native bir sistem penceresidir ve `integration_test` widget
/// agacindan DOKUNAMAZ.
Future<void> loginAndReachHome(WidgetTester tester) async {
  assert(
    testUserEmail.isNotEmpty && testUserPassword.isNotEmpty,
    'TEST_USER_EMAIL ve TEST_USER_PASSWORD --dart-define ile verilmeli - '
    'bu dosyanin basindaki kullanim ornegine bakin.',
  );

  // Gercek cihazda `flutter test integration_test/... -d <cihaz>` ile
  // yapilan TAZE bir kurulumdan hemen sonra, uygulama surecinin agdan
  // sorumlu native katmani birkaç saniye icinde HENUZ HAZIR olmayabiliyor -
  // bu pencerede atilan ilk istek `SocketException: No route to host`
  // (errno 65) ile basarisiz olup Splash'i "Sunucuya bağlanılamadı" hatasinda
  // birakabiliyor (canli cihazda dogrulanan bir yaris durumu; `flutter run`
  // ile normal baslatildiginda sorun degil, cunku ilk ag cagrisina kadar
  // zaten birkaç saniye geciyor). Sabit bir bekleme suresi GUVENILIR
  // degil (olcum sirasinda gecikme 1-2 saniye arasinda degisti) - bunun
  // yerine Splash'in kendi "Tekrar Dene" dugmesine (`ref.refresh()`i
  // tetikler) basilarak GERCEK bir kullanicinin yapacagi sey yapilir.
  await tester.pumpWidget(const ProviderScope(child: CongressBeaconApp()));

  // AppBar basligi 'Ana Sayfa' isaretci OLARAK KULLANILAMAZ: alt sekme
  // cubugundaki 'Ana Sayfa' etiketi TUM sekmelerde (hangisi secili olursa
  // olsun) ekranda kalir - ayni metinle CAKISIR. Home sekmesine OZGU,
  // yalnizca o sekmenin icerigi yuklendiginde var olan bir Key kullanilir.
  final homeMarker = find.byKey(WidgetKeys.homeContentButtonProgram);
  final loginButton = find.widgetWithText(FilledButton, 'Giriş Yap');
  final retryButton = find.widgetWithText(FilledButton, 'Tekrar Dene');
  var loginSubmitted = false;
  var congressSelected = false;
  var lastRetryTap = DateTime.fromMillisecondsSinceEpoch(0);
  var retryTapCount = 0;

  final deadline = DateTime.now().add(const Duration(seconds: 30));
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 300));

    if (homeMarker.evaluate().isNotEmpty) return;

    // Konum izni bu cihazda GERCEKTEN "Her Zaman Izin Ver" ile verilmemis
    // (veya `--uninstall` [varsayilan] ile bir onceki calistirmada silinip
    // sifirlanmis, bkz. `flutter test --help --verbose` -> `--[no-]uninstall`)
    // - izin diyalogu NATIVE bir sistem penceresidir, integration_test
    // widget agacindan DOKUNAMAZ. Genel zaman asimina birakmak yerine
    // ACIKCA teshis edilir.
    if (find.text('İzin Ver').evaluate().isNotEmpty) {
      fail(
        'İzin ekraninda (/permission) TAKILI - konum izni bu cihazda HENUZ '
        '"Her Zaman Izin Ver" ile verilmemis (ya da bir onceki calistirma '
        '"--uninstall" ile uygulamayi silip izni sifirladi). Cozum: '
        'uygulamayi cihazda ACIP izni elle verin, sonraki calistirmalarda '
        'HER ZAMAN "--no-uninstall" bayragini kullanin (bkz. bu dosyanin '
        'basindaki kullanim ornegi).',
      );
    }

    // `AuthSessionNotifier.build()` yerel bir `MeResponse` onbellegi
    // TUTMAZ - taze bir sureçte (integration_test her `flutter test`
    // cagrisinda YENI bir surec baslatir) token Keychain'de olsa bile
    // `/auth/me`ye ag erisimi olmadan oturum ASLA `AsyncData` olamaz;
    // Splash bu ekranda TAKILI kalir (bkz. `route_redirect.dart` §
    // "authLoading || authHasError -> /splash"). Yukaridaki soguk-baslangic
    // ag yarisi genellikle 1-2 "Tekrar Dene" denemesinde kendini duzeltir;
    // eger 30 saniyelik genel sinira kadar duzelmezse bu GERCEK bir
    // baglanti sorunudur (ör. `cevrimdisi_test.dart` FAZ 2'de backend
    // GERCEKTEN kapaliyken) ve dongu sonunda asagidaki genel `fail()` ile
    // raporlanir - bu, Program ekraninin kalici onbellegine bu senaryoda
    // HIC ULASILAMADIGINI gosteren, Faz 7 kapsaminda DUZELTILMEMIS bilinen
    // bir mimari bulgudur.
    if (retryButton.evaluate().isNotEmpty &&
        DateTime.now().difference(lastRetryTap) >
            const Duration(milliseconds: 1500)) {
      await tester.tap(retryButton.first);
      lastRetryTap = DateTime.now();
      retryTapCount++;
      continue;
    }

    if (!loginSubmitted && loginButton.evaluate().isNotEmpty) {
      await tester.enterText(find.byType(TextFormField).first, testUserEmail);
      await tester.enterText(
        find.byType(TextFormField).at(1),
        testUserPassword,
      );
      await tester.tap(loginButton);
      loginSubmitted = true;
      continue;
    }

    if (!congressSelected) {
      final congressCard = find.text(testCongressName);
      if (congressCard.evaluate().isNotEmpty) {
        final cardInkWell = find
            .ancestor(of: congressCard, matching: find.byType(InkWell))
            .first;
        await tester.ensureVisible(cardInkWell);
        await tester.pump(const Duration(milliseconds: 300));
        await tester.tap(cardInkWell);
        congressSelected = true;
        continue;
      }
    }
  }

  fail(
    'Ana Sayfa 30 saniye icinde bulunamadi ($retryTapCount kez "Tekrar '
    'Dene" denendi) - eger retryTapCount > 0 ise bu muhtemelen GERCEK bir '
    'baglanti sorunu (ör. backend gercekten kapali/erisilemez), soguk-'
    'baslangic ag yarisi degil. retryTapCount == 0 ise TEST_USER_EMAIL/'
    'TEST_USER_PASSWORD/TEST_CONGRESS_NAME degerlerini kontrol edin.',
  );
}

/// `WidgetKeys.shellTab*` alt sekmedeki simgeye AIT - kabuk goruntulendigi
/// surece (hangi sekme secili olursa olsun) ekranda kalir, bu yuzden TEK
/// BASINA "su an hangi sekmedeyiz" sorusuna cevap vermez. Sekme icerigi
/// yuklenene kadar bekleyip o sekmeye OZGU bir isaretciyi arar.
Future<void> switchToTab(WidgetTester tester, Key tabKey, Finder marker) async {
  // Sekme dokunmadan ONCE ekranda GERCEKTEN var olmali - cagiran taraf
  // (ör. yazi olcegi degisiminden hemen sonra) araya baska bir pump
  // eklemeyi unutursa `tester.tap()` "0 widget bulundu" ile SERT
  // basarisiz olurdu; burada kisa bir bekleme bunu tolere eder.
  await pumpUntilFound(tester, find.byKey(tabKey));
  await tester.tap(find.byKey(tabKey));
  await pumpUntilFound(tester, marker);
}
