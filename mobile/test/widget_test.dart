import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:beacon/main.dart';

void main() {
  testWidgets('CongressBeaconApp acilista cokmeden bir Scaffold gosterir', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: CongressBeaconApp()));

    // Izin/oturum durumu platform kanallarindan (flutter_beacon,
    // flutter_secure_storage) test ortaminda gercek sonuc DONMEZ -
    // uygulamanin bunu cokmeden ele alip (bkz. PermissionGateNotifier'in
    // try/catch'i, AuthSessionNotifier'in AsyncError yolu) HERHANGI bir
    // ekran gostermesi yeterli; hangi rotada karar kildigi bu testin
    // konusu degil (bkz. route_redirect_test.dart).
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(Scaffold), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
