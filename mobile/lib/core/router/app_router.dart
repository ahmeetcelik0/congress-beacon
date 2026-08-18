import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_session_provider.dart';
import '../../features/auth/presentation/change_password_page.dart';
import '../../features/auth/presentation/forgot_password_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/register_page.dart';
import '../../features/congress/presentation/select_congress_page.dart';
import '../../features/content/presentation/announcements_page.dart';
import '../../features/content/presentation/info_sections_page.dart';
import '../../features/content/presentation/sponsors_page.dart';
import '../../features/content/presentation/speakers_page.dart';
import '../../features/content/presentation/venues_page.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/permission/application/permission_gate_provider.dart';
import '../../features/permission/presentation/permission_gate_page.dart';
import '../../features/program/presentation/program_page.dart';
import '../../features/program/presentation/session_detail_page.dart';
import '../../features/shell/presentation/app_shell.dart';
import '../../features/shell/presentation/splash_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import 'route_redirect.dart';

/// Riverpod durum degisikliklerini go_router'in `refreshListenable`ina
/// koprulemek icin kucuk bir yardimci - GoRouter kendisi Riverpod'u
/// bilmez, bu yuzden ilgili provider'lar her degistiginde `notifyListeners()`
/// cagirip yeniden yonlendirme (redirect) degerlendirmesini tetikler.
class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen(permissionGateProvider, (_, _) => notifyListeners());
    ref.listen(authSessionProvider, (_, _) => notifyListeners());
  }
}

final goRouterProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = _RouterRefreshNotifier(ref);
  ref.onDispose(refreshNotifier.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final permissionStatus = ref.read(permissionGateProvider);
      final authState = ref.read(authSessionProvider);
      final me = authState.value;

      return computeRedirectPath(
        location: state.matchedLocation,
        permissionLoading: permissionStatus == PermissionGateStatus.loading,
        permissionSufficient:
            permissionStatus == PermissionGateStatus.sufficient,
        authLoading: authState.isLoading,
        authHasError: authState.hasError,
        isAuthenticated: me != null,
        mustChangePassword: me?.mustChangePassword ?? false,
        activeCongressId: me?.activeCongressId,
      );
    },
    routes: [
      GoRoute(
        path: '/splash',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SplashPage()),
      ),
      GoRoute(
        path: '/permission',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: PermissionGatePage()),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: LoginPage()),
      ),
      GoRoute(
        path: '/register',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: RegisterPage()),
      ),
      GoRoute(
        path: '/forgot-password',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: ForgotPasswordPage()),
      ),
      GoRoute(
        path: '/change-password',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: ChangePasswordPage()),
      ),
      GoRoute(
        path: '/select-congress',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SelectCongressPage()),
      ),
      // Icerik alt ekranlari (Faz 7) - BILEREK ShellRoute DISINDA: tam
      // ekran + geri tusuyla acilirlar, sekme cubugu/izin seridi
      // GORUNMEZ (bkz. `/change-password`/`/select-congress`ile AYNI
      // kurulmus desen).
      GoRoute(
        path: '/announcements',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: AnnouncementsPage()),
      ),
      GoRoute(
        path: '/sponsors',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SponsorsPage()),
      ),
      GoRoute(
        path: '/speakers',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SpeakersPage()),
      ),
      GoRoute(
        path: '/venues',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: VenuesPage()),
      ),
      GoRoute(
        path: '/info-sections',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: InfoSectionsPage()),
      ),
      GoRoute(
        path: '/session/:id',
        pageBuilder: (context, state) => NoTransitionPage(
          child: SessionDetailPage(sessionId: state.pathParameters['id']!),
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          // Faz 10: alt sekmeler ARASINDA da kayma animasyonu OLMASIN diye
          // (bkz. docs/decisions.md "Faz 10") - `builder:` yerine
          // `pageBuilder:` ile `NoTransitionPage` kullanilir (go_router'in
          // kendi sagladigi, animasyonsuz `CustomTransitionPage` varyanti).
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: HomePage()),
          ),
          GoRoute(
            path: '/program',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ProgramPage()),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ProfilePage()),
          ),
        ],
      ),
    ],
  );
});
