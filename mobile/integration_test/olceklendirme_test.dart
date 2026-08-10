import 'package:beacon/core/testing/widget_keys.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'test_helpers.dart';

/// Buyuk sistem yazi olceginde duzen tasmasi (`RenderFlex overflowed`)
/// olup olmadigini sinar.
///
/// NOT: `main.dart`daki `CongressBeaconApp.builder`, TUM sistem
/// olceklerini KENETLER (`textScaler.clamp(minScaleFactor: 0.9,
/// maxScaleFactor: 1.3)`, bkz. Faz 6 talimati §3) - yani uygulama
/// HICBIR ZAMAN 1.3'ten buyuk bir olcekle CIZILMEZ, sisteme "2.0" veya
/// daha fazlasi verilse bile. Bu test hem GERCEKTEN ulasilabilir ust
/// sinirda (1.3) hem de kenetlenmesi gereken asiri girdi degerlerinde
/// (2.0, 5.0) tasma OLMADIGINI - ve kenedin gercekten calistigini -
/// dogrular.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const scaleFactors = [0.9, 1.0, 1.15, 1.3, 2.0, 5.0];

  final contentButtons = <Key, Key>{
    WidgetKeys.homeContentButtonInfoSections: WidgetKeys.infoSectionsScreen,
    WidgetKeys.homeContentButtonVenues: WidgetKeys.venuesScreen,
    WidgetKeys.homeContentButtonSpeakers: WidgetKeys.speakersScreen,
    WidgetKeys.homeContentButtonAnnouncements: WidgetKeys.announcementsScreen,
    WidgetKeys.homeContentButtonSponsors: WidgetKeys.sponsorsScreen,
  };

  testWidgets(
    'Artan yazi olceklerinde ana ekranlarda tasma (overflow) olusmaz',
    (tester) async {
      await loginAndReachHome(tester);
      final homeMarker = find.byKey(WidgetKeys.homeContentButtonProgram);

      addTearDown(
        tester.binding.platformDispatcher.clearTextScaleFactorTestValue,
      );

      for (final scale in scaleFactors) {
        tester.binding.platformDispatcher.textScaleFactorTestValue = scale;
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        await switchToTab(tester, WidgetKeys.shellTabHome, homeMarker);
        expect(
          tester.takeException(),
          isNull,
          reason: 'Ana Sayfa - yazi olcegi $scale',
        );

        for (final entry in contentButtons.entries) {
          // Buyuk yazi olceginde izgara elemanlari DAHA da asagi kayar -
          // once gorunur alana getirmeden dokunmak yanlis bir noktaya
          // isabet edebilir (bkz. navigasyon_test.dart'ta ayni sebeple
          // eklenen `ensureVisible`).
          await tester.ensureVisible(find.byKey(entry.key));
          await tester.pump(const Duration(milliseconds: 300));
          await tester.tap(find.byKey(entry.key));
          await pumpUntilFound(tester, find.byKey(entry.value));
          expect(
            tester.takeException(),
            isNull,
            reason: '${entry.value} - yazi olcegi $scale',
          );

          await tester.pageBack();
          await pumpUntilFound(tester, homeMarker);
          expect(
            tester.takeException(),
            isNull,
            reason: 'Ana Sayfa\'ya donus - yazi olcegi $scale',
          );
        }

        await switchToTab(
          tester,
          WidgetKeys.shellTabProgram,
          find.byKey(WidgetKeys.programSearchField),
        );
        expect(
          tester.takeException(),
          isNull,
          reason: 'Bilimsel Program - yazi olcegi $scale',
        );

        final sessionCards = find.byWidgetPredicate(
          (widget) =>
              widget.key is ValueKey<String> &&
              (widget.key! as ValueKey<String>).value.startsWith(
                'program_session_card_',
              ),
        );
        if (sessionCards.evaluate().isNotEmpty) {
          await tester.ensureVisible(sessionCards.first);
          await tester.pump(const Duration(milliseconds: 300));
          await tester.tap(sessionCards.first);
          await pumpUntilFound(
            tester,
            find.byKey(WidgetKeys.sessionDetailScreen),
          );
          expect(
            tester.takeException(),
            isNull,
            reason: 'Oturum Detayı - yazi olcegi $scale',
          );

          await tester.pageBack();
          await pumpUntilFound(
            tester,
            find.byKey(WidgetKeys.programSearchField),
          );
        }

        await switchToTab(
          tester,
          WidgetKeys.shellTabProfile,
          find.text('Profilim'),
        );
        expect(
          tester.takeException(),
          isNull,
          reason: 'Profilim - yazi olcegi $scale',
        );
      }
    },
  );
}
