import 'package:beacon/core/network/api_client.dart';
import 'package:beacon/core/network/api_endpoints.dart';
import 'package:beacon/core/testing/widget_keys.dart';
import 'package:beacon/core/utils/turkish_date_format.dart';
import 'package:beacon/models/mobile_content_models.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'test_helpers.dart';

/// Program ekraninin GERCEK backend verisiyle dogrulanmasi. Beklenen
/// sonuclar hangi kongre/test verisi seed edilmis oldugundan BAGIMSIZ
/// olsun diye kod icine GOMULMEZ - uygulamanin kullandigi AYNI
/// `/mobile/program` ucundan uretim kodu (`ApiClient`, testte YENIDEN
/// YAZILMAZ) ile canli cekilip bagimsiz hesaplanir; UI'da gorunen o
/// veriyle karsilastirilir.
Future<MobileProgramResponse> _fetchProgramDirectly() async {
  final apiClient = ApiClient();
  final result = await apiClient.get(
    ApiEndpoints.mobileProgram,
    requiresAuth: true,
  );
  return MobileProgramResponse.fromJson(result.data as Map<String, dynamic>);
}

/// `program_page.dart`taki `_deriveDayOrder` ile AYNI algoritmanin
/// bagimsiz bir kopyasi - testin, uygulamanin kendi hesapladigi sirayi
/// degil GERCEKTEN dogru sirayi dogrulayabilmesi icin. Faz 10: gruplama
/// anahtari artik `dayLabel` DEGIL, gercek `startTime`den turetilen
/// takvim gunu (`dayKey`) - bkz. docs/decisions.md "Faz 10".
List<String> _deriveExpectedDayOrder(List<MobileSession> sessions) {
  final firstStartByKey = <String, DateTime>{};
  for (final session in sessions) {
    final key = dayKey(session.startTime);
    final existing = firstStartByKey[key];
    if (existing == null || session.startTime.isBefore(existing)) {
      firstStartByKey[key] = session.startTime;
    }
  }
  final keys = firstStartByKey.keys.toList();
  keys.sort((a, b) => firstStartByKey[a]!.compareTo(firstStartByKey[b]!));
  return keys;
}

/// `program_page.dart`taki `_isMinorEvent` ile AYNI kural - mola/toren/
/// diger turler `_SessionCard` DEGIL `_MinorEventRow` ile cizilir, bu
/// yuzden `WidgetKeys.programSessionCard` anahtarini TASIMAZLAR (bkz.
/// docs/decisions.md "Faz 10" - gercek cihazda dogrulanan kasitli
/// davranis: bu satirlar gorsel olarak ayrisik VE dokunulamaz).
bool _isMinorEvent(String? sessionType) =>
    sessionType == 'break' || sessionType == 'ceremony' || sessionType == 'other';

/// `program_page.dart`taki `_filter`in arama kismi ile AYNI kural.
bool _matchesQuery(MobileSession session, String normalizedQuery) {
  if (session.title.toLowerCase().contains(normalizedQuery)) return true;
  if (session.hallName.toLowerCase().contains(normalizedQuery)) return true;
  for (final role in session.roles) {
    if (role.rawName.toLowerCase().contains(normalizedQuery)) return true;
  }
  for (final presentation in session.presentations) {
    if (presentation.title.toLowerCase().contains(normalizedQuery)) {
      return true;
    }
    for (final role in presentation.roles) {
      if (role.rawName.toLowerCase().contains(normalizedQuery)) return true;
    }
  }
  return false;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Gun sekmeleri kronolojik sirada gorunur', (tester) async {
    await loginAndReachHome(tester);
    await switchToTab(
      tester,
      WidgetKeys.shellTabProgram,
      find.byKey(WidgetKeys.programSearchField),
    );

    final program = await _fetchProgramDirectly();
    final expectedDayOrder = _deriveExpectedDayOrder(program.sessions);

    if (expectedDayOrder.length < 2) {
      markTestSkipped(
        'Test kongresinde 2den az farkli gun etiketi var - sira testi '
        'anlamli degil (${expectedDayOrder.length} gun bulundu).',
      );
      return;
    }

    final dayFinders = [
      for (final day in expectedDayOrder)
        find.byKey(WidgetKeys.programDayTab(day)),
    ];
    for (var i = 0; i < dayFinders.length; i++) {
      expect(
        dayFinders[i],
        findsOneWidget,
        reason: '"${expectedDayOrder[i]}" gun sekmesi ekranda bulunamadi.',
      );
    }

    final xPositions = [
      for (final finder in dayFinders) tester.getCenter(finder).dx,
    ];
    for (var i = 1; i < xPositions.length; i++) {
      expect(
        xPositions[i],
        greaterThan(xPositions[i - 1]),
        reason:
            '"${expectedDayOrder[i]}" gun sekmesi "${expectedDayOrder[i - 1]}"'
            ' sekmesinden SOLDA gorunuyor - kronolojik sira bozuk.',
      );
    }
  });

  testWidgets('Arama yerelde calisir ve sonuclari dogru filtreler', (
    tester,
  ) async {
    await loginAndReachHome(tester);
    await switchToTab(
      tester,
      WidgetKeys.shellTabProgram,
      find.byKey(WidgetKeys.programSearchField),
    );

    final program = await _fetchProgramDirectly();

    String? query;
    outer:
    for (final session in program.sessions) {
      final candidates = [
        ...session.roles.map((r) => r.rawName),
        for (final p in session.presentations) ...p.roles.map((r) => r.rawName),
      ];
      for (final name in candidates) {
        if (name.trim().length >= 5) {
          query = name;
          break outer;
        }
      }
    }

    if (query == null) {
      markTestSkipped(
        'Test kongresinde arama icin uygun (>=5 karakter) bir '
        'konusmaci/moderator adi bulunamadi.',
      );
      return;
    }

    final normalizedQuery = query.trim().toLowerCase();
    final expectedMatchIds = program.sessions
        .where((s) => _matchesQuery(s, normalizedQuery))
        .map((s) => s.id)
        .toSet();
    final expectedNonMatchIds = program.sessions
        .map((s) => s.id)
        .toSet()
        .difference(expectedMatchIds);

    await tester.enterText(
      find.byKey(WidgetKeys.programSearchField),
      query.trim(),
    );
    await tester.pump(const Duration(milliseconds: 400));

    for (final id in expectedMatchIds) {
      expect(
        find.byKey(WidgetKeys.programSessionCard(id)),
        findsOneWidget,
        reason: '"$query" aramasi eslesmesi gereken $id oturumunu gostermedi.',
      );
    }
    for (final id in expectedNonMatchIds) {
      expect(
        find.byKey(WidgetKeys.programSessionCard(id)),
        findsNothing,
        reason:
            '"$query" aramasi eslesmemesi gereken $id oturumunu YINE DE '
            'gosterdi.',
      );
    }
  });

  testWidgets('Salon filtresi calisir', (tester) async {
    await loginAndReachHome(tester);
    await switchToTab(
      tester,
      WidgetKeys.shellTabProgram,
      find.byKey(WidgetKeys.programSearchField),
    );

    final program = await _fetchProgramDirectly();
    final expectedDayOrder = _deriveExpectedDayOrder(program.sessions);
    if (expectedDayOrder.isEmpty) {
      markTestSkipped('Test kongresinde gun etiketli oturum bulunamadi.');
      return;
    }
    final currentDay = expectedDayOrder.first;
    // Mola/toren/diger turler `programSessionCard` anahtarini TASIMAZ
    // (bkz. yukaridaki `_isMinorEvent` yorumu) - salon filtresi testi
    // yalnizca gercek kart olarak cizilen oturumlari kontrol edebilir.
    final daySessions = program.sessions
        .where(
          (s) => dayKey(s.startTime) == currentDay && !_isMinorEvent(s.sessionType),
        )
        .toList();

    final hallCounts = <String, int>{};
    for (final s in daySessions) {
      hallCounts[s.hallId] = (hallCounts[s.hallId] ?? 0) + 1;
    }
    MapEntry<String, int>? targetHallEntry;
    for (final entry in hallCounts.entries) {
      if (entry.value < daySessions.length) {
        targetHallEntry = entry;
        break;
      }
    }

    if (targetHallEntry == null) {
      markTestSkipped(
        'Secili gundeki tum oturumlar tek bir salonda - salon filtresinin '
        'gorunur bir fark yaratmasi mumkun degil.',
      );
      return;
    }

    final targetHallId = targetHallEntry.key;
    final expectedIds = daySessions
        .where((s) => s.hallId == targetHallId)
        .map((s) => s.id)
        .toSet();
    final excludedIds = daySessions
        .map((s) => s.id)
        .toSet()
        .difference(expectedIds);

    final hallChip = find.byKey(WidgetKeys.programHallFilter(targetHallId));
    await tester.ensureVisible(hallChip);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(hallChip);
    await tester.pumpAndSettle(const Duration(milliseconds: 300));

    // Gercek kongre programi tek bir salonda bile bir gunun tamamini
    // kaplayabiliyor (bkz. docs/decisions.md "Faz 10" - 74 oturumluk
    // "Deneme" verisi) - `ListView.separated` uzak ogeleri henuz
    // insa ETMEMIS olabilir, bu yuzden dogrudan `find.byKey` yerine
    // listeyi kaydirarak arayan `scrollUntilVisible` kullanilir.
    final verticalSessionList = find.byWidgetPredicate(
      (w) => w is ListView && w.scrollDirection == Axis.vertical,
    );
    for (final id in expectedIds) {
      final cardFinder = find.byKey(WidgetKeys.programSessionCard(id));
      await tester.scrollUntilVisible(
        cardFinder,
        200,
        scrollable: find.descendant(
          of: verticalSessionList,
          matching: find.byType(Scrollable),
        ),
      );
      expect(cardFinder, findsOneWidget);
    }
    for (final id in excludedIds) {
      expect(find.byKey(WidgetKeys.programSessionCard(id)), findsNothing);
    }
  });
}
