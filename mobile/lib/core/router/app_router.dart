import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_session_provider.dart';
import '../../features/auth/presentation/change_password_page.dart';
import '../../features/auth/presentation/forgot_password_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/register_page.dart';
import '../../features/congress/presentation/select_congress_page.dart';
import '../../features/permission/application/permission_gate_provider.dart';
import '../../features/permission/presentation/permission_gate_page.dart';
import '../../features/shell/presentation/app_shell.dart';
import '../../features/shell/presentation/home_placeholder_page.dart';
import '../../features/shell/presentation/program_placeholder_page.dart';
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
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const HomePlaceholderPage(),
          ),
          GoRoute(
            path: '/program',
            builder: (context, state) => const ProgramPlaceholderPage(),
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
