import 'package:flutter_test/flutter_test.dart';
import 'package:beacon/core/router/route_redirect.dart';

// computeRedirectPath saf bir fonksiyon (Flutter/Riverpod/go_router'dan
// bagimsiz) - Faz 6 talimatinin izin -> oturum -> zorunlu sifre -> kongre
// secimi -> kabuk sirasini burada dogrudan test ediyoruz.
void main() {
  group('computeRedirectPath - yukleniyor/hata durumlari', () {
    test('izin yuklenirken splash a yonlendirir', () {
      final result = computeRedirectPath(
        location: '/login',
        permissionLoading: true,
        permissionSufficient: false,
        authLoading: false,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, '/splash');
    });

    test('oturum yuklenirken splash ta zaten ise yonlendirme YAPILMAZ', () {
      final result = computeRedirectPath(
        location: '/splash',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: true,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, isNull);
    });

    test(
      'oturum kontrolu hata verirse splash a yonlendirir (giris ekranina degil)',
      () {
        final result = computeRedirectPath(
          location: '/login',
          permissionLoading: false,
          permissionSufficient: true,
          authLoading: false,
          authHasError: true,
          isAuthenticated: false,
          mustChangePassword: false,
          activeCongressId: null,
        );
        expect(result, '/splash');
      },
    );
  });

  group('computeRedirectPath - izin', () {
    test('izin yetersizKEN oturum kontrolu AG HATASI verse bile /permission '
        'kazanir (Simulator dogrulamasinda yakalanan regresyon - izin, '
        'oturum hatasindan once degerlendirilmeli)', () {
      final result = computeRedirectPath(
        location: '/login',
        permissionLoading: false,
        permissionSufficient: false,
        authLoading: false,
        authHasError: true,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, '/permission');
    });

    test('izin yetersizse /permission a yonlendirir', () {
      final result = computeRedirectPath(
        location: '/login',
        permissionLoading: false,
        permissionSufficient: false,
        authLoading: false,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, '/permission');
    });

    test('zaten /permission dayken tekrar yonlendirme YAPILMAZ', () {
      final result = computeRedirectPath(
        location: '/permission',
        permissionLoading: false,
        permissionSufficient: false,
        authLoading: false,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, isNull);
    });
  });

  group('computeRedirectPath - oturum', () {
    test('izin yeterli ama giris yapilmamissa /login a yonlendirir', () {
      final result = computeRedirectPath(
        location: '/home',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, '/login');
    });

    test('giris yapilmamisken /register serbest kalir (yonlendirme yok)', () {
      final result = computeRedirectPath(
        location: '/register',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, isNull);
    });

    test('giris yapilmamisken /forgot-password serbest kalir', () {
      final result = computeRedirectPath(
        location: '/forgot-password',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: false,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, isNull);
    });
  });

  group('computeRedirectPath - zorunlu sifre degisikligi', () {
    test('mustChangePassword true ise /change-password a KILITLER', () {
      final result = computeRedirectPath(
        location: '/home',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: true,
        mustChangePassword: true,
        activeCongressId: null,
      );
      expect(result, '/change-password');
    });

    test(
      'mustChangePassword true iken kongre secim ekranina bile GIDILEMEZ',
      () {
        final result = computeRedirectPath(
          location: '/select-congress',
          permissionLoading: false,
          permissionSufficient: true,
          authLoading: false,
          authHasError: false,
          isAuthenticated: true,
          mustChangePassword: true,
          activeCongressId: null,
        );
        expect(result, '/change-password');
      },
    );
  });

  group('computeRedirectPath - kongre secimi', () {
    test('aktif kongre yoksa /select-congress a yonlendirir', () {
      final result = computeRedirectPath(
        location: '/home',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: true,
        mustChangePassword: false,
        activeCongressId: null,
      );
      expect(result, '/select-congress');
    });
  });

  group('computeRedirectPath - kabuk', () {
    test(
      'her sart saglanmissa giris noktasi ekranlarindan /home a gonderir',
      () {
        final result = computeRedirectPath(
          location: '/login',
          permissionLoading: false,
          permissionSufficient: true,
          authLoading: false,
          authHasError: false,
          isAuthenticated: true,
          mustChangePassword: false,
          activeCongressId: 'congress-1',
        );
        expect(result, '/home');
      },
    );

    test('her sart saglanmisken /program serbest kalir (kabuk ici sekme)', () {
      final result = computeRedirectPath(
        location: '/program',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: true,
        mustChangePassword: false,
        activeCongressId: 'congress-1',
      );
      expect(result, isNull);
    });

    test('kongre secilmisken /select-congress GONULLU ziyaret edilebilir '
        '(Kongre Degistir) - zorla /home a atilmaz', () {
      final result = computeRedirectPath(
        location: '/select-congress',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: true,
        mustChangePassword: false,
        activeCongressId: 'congress-1',
      );
      expect(result, isNull);
    });

    test('sifre zaten degistirilmisken /change-password GONULLU ziyaret '
        'edilebilir (Profilim) - zorla /home a atilmaz', () {
      final result = computeRedirectPath(
        location: '/change-password',
        permissionLoading: false,
        permissionSufficient: true,
        authLoading: false,
        authHasError: false,
        isAuthenticated: true,
        mustChangePassword: false,
        activeCongressId: 'congress-1',
      );
      expect(result, isNull);
    });
  });
}
