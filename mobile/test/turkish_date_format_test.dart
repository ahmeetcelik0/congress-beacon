import 'package:flutter_test/flutter_test.dart';
import 'package:beacon/core/utils/turkish_date_format.dart';

// Faz 12: bu testler cihazin/test ortaminin saat diliminden BAGIMSIZ ayni
// sonucu vermelidir - eski `.toLocal()` deseni CIHAZ saatini varsayiyordu,
// yurt disindaki bir katilimcinin telefonunda kongre saatleri kayardi
// (bkz. docs/decisions.md "Faz 12").
void main() {
  group('toIstanbulTime', () {
    test('UTC 12:00 -> Istanbul 15:00 (sabit +3)', () {
      final utc = DateTime.utc(2026, 9, 1, 12, 0);
      final istanbul = toIstanbulTime(utc);
      expect(istanbul.hour, 15);
      expect(istanbul.day, 1);
      expect(istanbul.month, 9);
    });

    test('gece yarisini dogru gecer (UTC 21:00 -> ertesi gun 00:00)', () {
      final utc = DateTime.utc(2026, 9, 9, 21, 0);
      final istanbul = toIstanbulTime(utc);
      expect(istanbul.day, 10);
      expect(istanbul.hour, 0);
    });
  });

  group('formatTime', () {
    test('UTC 12:00 -> "15:00" gosterir', () {
      expect(formatTime(DateTime.utc(2026, 9, 1, 12, 0)), '15:00');
    });
  });

  group('dayKey', () {
    test('UTC 21:00 -> ertesi gunun anahtarini uretir (gun kaymasi kontrolu)', () {
      // Turkiye'de 10 Eylul 00:00'a denk gelen bu an, cihaz saatine gore
      // (ör. bir Avrupa TZ'sinde) hala "9 Eylul" olarak GRUPLANABILIRDI -
      // toIstanbulTime KULLANILDIGI icin her zaman "2026-09-10" doner.
      expect(dayKey(DateTime.utc(2026, 9, 9, 21, 0)), '2026-09-10');
    });
  });

  group('formatShortDateWithYear', () {
    test('UTC 21:00 -> ertesi gunun tarihini gosterir', () {
      expect(formatShortDateWithYear(DateTime.utc(2026, 9, 9, 21, 0)), '10.09.2026');
    });
  });
}
