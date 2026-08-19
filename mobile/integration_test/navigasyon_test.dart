import 'package:beacon/core/testing/widget_keys.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'test_helpers.dart';

/// Faz 7 XCUITest -> integration_test gecis talimati §4: 3 sekme arasi
/// gecis, 6 icerik butonunun acilip geri donulmesi, oturum detayina
/// girilip cikilmasi. Her adimda BEKLENEN bir ogenin ekranda gercekten
/// belirdigi dogrulanir (yalnizca "cokmedi" degil).
///
/// NOT: `find.text('Ana Sayfa')` "su an Ana Sayfa'dayiz" isaretcisi OLARAK
/// KULLANILMAZ - bu metin ayni zamanda alt sekme cubugunun 'Ana Sayfa'
/// etiketi olarak TUM sekmelerde ekranda kalir (bkz. `test_helpers.dart`).
/// Bunun yerine Home icerigine OZGU `homeContentButtonProgram` Key'i
/// kullanilir.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final homeMarker = find.byKey(WidgetKeys.homeContentButtonProgram);

  testWidgets('Alt sekmeler arasinda gecis yapilabilir', (tester) async {
    await loginAndReachHome(tester);
    expect(homeMarker, findsOneWidget);

    await switchToTab(
      tester,
      WidgetKeys.shellTabProgram,
      find.byKey(WidgetKeys.programSearchField),
    );
    expect(find.text('Bilimsel Program'), findsOneWidget);

    await switchToTab(
      tester,
      WidgetKeys.shellTabProfile,
      find.text('Profilim'),
    );
    expect(find.text('Profilim'), findsOneWidget);

    await switchToTab(tester, WidgetKeys.shellTabHome, homeMarker);
    expect(homeMarker, findsOneWidget);
  });

  testWidgets('Ana Sayfa\'daki 6 icerik butonu acilip geri donulebilir', (
    tester,
  ) async {
    await loginAndReachHome(tester);

    // Bilimsel Program HARIC 5 buton yeni (push edilen) bir ekran acar -
    // geri tusuyla Ana Sayfa'ya donulur (bkz. app_router.dart, bu 5 rota
    // ShellRoute DISINDA tanimli).
    final pushedScreens = <Key, Key>{
      WidgetKeys.homeContentButtonInfoSections: WidgetKeys.infoSectionsScreen,
      WidgetKeys.homeContentButtonVenues: WidgetKeys.venuesScreen,
      WidgetKeys.homeContentButtonSpeakers: WidgetKeys.speakersScreen,
      WidgetKeys.homeContentButtonAnnouncements: WidgetKeys.announcementsScreen,
      WidgetKeys.homeContentButtonSponsors: WidgetKeys.sponsorsScreen,
    };

    for (final entry in pushedScreens.entries) {
      // Ana Sayfa'nin icerik izgarasi disaridaki `ListView` icinde - alt
      // sirali butonlar (Duyurular/Sponsorlar) ekran yuksekligine gore
      // GORUNUR ALAN DISINDA kalabilir; `tap()` kaydirma yapmaz, once
      // widget'i gorunur alana getirmek gerekir (gercek cihazda "did not
      // hit test" ile yakalanan bir hata - dokunma, alttaki sekme
      // cubuguna isabet ediyordu).
      await tester.ensureVisible(find.byKey(entry.key));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(entry.key));
      await pumpUntilFound(tester, find.byKey(entry.value));
      expect(find.byKey(entry.value), findsOneWidget);

      await tester.pageBack();
      await pumpUntilFound(tester, homeMarker);
    }

    // Bilimsel Program butonu FARKLI: yeni bir ekran acmaz, alt sekmeye
    // gecirir (bkz. home_page.dart `_ContentGrid` yorumu).
    await tester.ensureVisible(find.byKey(WidgetKeys.homeContentButtonProgram));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byKey(WidgetKeys.homeContentButtonProgram));
    await pumpUntilFound(tester, find.byKey(WidgetKeys.programSearchField));
    expect(find.text('Bilimsel Program'), findsOneWidget);
  });

  testWidgets('Oturum detayina girilip geri donulebilir', (tester) async {
    await loginAndReachHome(tester);

    await switchToTab(
      tester,
      WidgetKeys.shellTabProgram,
      find.byKey(WidgetKeys.programSearchField),
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
          'Program ekraninda hic oturum karti bulunamadi - test '
          'kongresinde secili gunde oturum olmayabilir.',
    );

    await tester.ensureVisible(sessionCards.first);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(sessionCards.first);
    await pumpUntilFound(tester, find.byKey(WidgetKeys.sessionDetailScreen));
    expect(find.text('Oturum Detayı'), findsOneWidget);

    await tester.pageBack();
    await pumpUntilFound(tester, find.byKey(WidgetKeys.programSearchField));
  });
}
