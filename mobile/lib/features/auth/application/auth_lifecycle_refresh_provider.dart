import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_session_provider.dart';

/// Uygulama arka plandan ON PLANA gelince, eger su an CEVRIMDISI bir
/// oturum gosteriliyorsa `/auth/me`yi otomatik olarak yeniden dener - ag
/// donduğunde kullanici elle "Tekrar Dene"ye basmak ZORUNDA kalmasin diye
/// (bkz. Faz 7.1 talimati §3 madde 5). `ObservationLifecycleNotifier` ile
/// AYNI desen: uygulama kokunde BIR KEZ izlenir (bkz. `main.dart`), kendi
/// yasam dongusunu `ref.onDispose` ile yonetir. `BeaconObservationService`in
/// ic mantigina HIC DOKUNMAZ, ondan tamamen bagimsizdir.
class AuthLifecycleRefreshNotifier extends Notifier<void> {
  AppLifecycleListener? _listener;

  @override
  void build() {
    _listener = AppLifecycleListener(onResume: _onResume);
    ref.onDispose(() {
      _listener?.dispose();
    });
  }

  void _onResume() {
    if (!ref.read(isOfflineSessionProvider)) return;
    unawaited(ref.read(authSessionProvider.notifier).refresh());
  }
}

final authLifecycleRefreshProvider =
    NotifierProvider<AuthLifecycleRefreshNotifier, void>(
      AuthLifecycleRefreshNotifier.new,
    );
