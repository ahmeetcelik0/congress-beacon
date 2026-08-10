import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/application/auth_lifecycle_refresh_provider.dart';
import 'features/observations/application/observation_lifecycle_provider.dart';

void main() {
  runApp(const ProviderScope(child: CongressBeaconApp()));
}

class CongressBeaconApp extends ConsumerWidget {
  const CongressBeaconApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Beacon servisinin yasam donguisu UYGULAMA KOKUNDE, hicbir ekrana bagli
    // olmadan izlenir - sekme degisimi/ekran gecisi bunu asla durdurmaz
    // (bkz. docs/decisions.md, Faz 6 talimati §7).
    ref.watch(observationLifecycleProvider);
    // Faz 7.1: cevrimdisi oturumu, uygulama on plana gelince otomatik
    // yeniden dogrular (bkz. auth_lifecycle_refresh_provider.dart).
    ref.watch(authLifecycleRefreshProvider);

    final router = ref.watch(goRouterProvider);

    return MaterialApp.router(
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      title: 'Kongre Beacon',
      theme: AppTheme.light,
      builder: (context, child) {
        if (child == null) return const SizedBox.shrink();
        // Buyuk sistem metin olceklendirmesinde duzen bozulmasin diye makul
        // bir aralikla sinirlanir (bkz. Faz 6 talimati §3).
        final mediaQuery = MediaQuery.of(context);
        final clampedScaler = mediaQuery.textScaler.clamp(
          minScaleFactor: 0.9,
          maxScaleFactor: 1.3,
        );
        return MediaQuery(
          data: mediaQuery.copyWith(textScaler: clampedScaler),
          child: child,
        );
      },
    );
  }
}
