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
      GoRoute(path: '/splash', builder: (context, state) => const SplashPage()),
      GoRoute(
        path: '/permission',
        builder: (context, state) => const PermissionGatePage(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordPage(),
      ),
      GoRoute(
        path: '/change-password',
        builder: (context, state) => const ChangePasswordPage(),
      ),
      GoRoute(
        path: '/select-congress',
        builder: (context, state) => const SelectCongressPage(),
      ),
      // Icerik alt ekranlari (Faz 7) - BILEREK ShellRoute DISINDA: tam
      // ekran + geri tusuyla acilirlar, sekme cubugu/izin seridi
      // GORUNMEZ (bkz. `/change-password`/`/select-congress`ile AYNI
      // kurulmus desen).
      GoRoute(
        path: '/announcements',
        builder: (context, state) => const AnnouncementsPage(),
      ),
      GoRoute(
        path: '/sponsors',
        builder: (context, state) => const SponsorsPage(),
      ),
      GoRoute(
        path: '/speakers',
        builder: (context, state) => const SpeakersPage(),
      ),
      GoRoute(path: '/venues', builder: (context, state) => const VenuesPage()),
      GoRoute(
        path: '/info-sections',
        builder: (context, state) => const InfoSectionsPage(),
      ),
      GoRoute(
        path: '/session/:id',
        builder: (context, state) =>
            SessionDetailPage(sessionId: state.pathParameters['id']!),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (context, state) => const HomePage()),
          GoRoute(
            path: '/program',
            builder: (context, state) => const ProgramPage(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfilePage(),
          ),
        ],
      ),
    ],
  );
});
