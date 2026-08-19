import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/app_router.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../models/auth_models.dart';
import '../../auth/application/auth_session_provider.dart';
import '../../permission/application/permission_gate_provider.dart';
import '../domain/push_notification_service.dart';

final pushNotificationServiceProvider = Provider<PushNotificationService>((
  ref,
) {
  return PushNotificationService();
});

/// FCM bildirimine dokunulup UYGULAMA henuz kabuga ULASMAMISKEN (ör. soguk
/// baslangicta giris/kongre secimi akisi surerken) yakalanan hedef -
/// `sessionId` doluysa oturum detayina, `isAggregate` true ise (birden
/// fazla oturumu kapsayan birlestirilmis bildirim, tek "oturum" YOKTUR)
/// programa gidilir (bkz. Faz 9 talimati §5).
class PendingDeepLink {
  const PendingDeepLink.session(this.sessionId) : isAggregate = false;

  const PendingDeepLink.aggregate() : sessionId = null, isAggregate = true;

  final String? sessionId;
  final bool isAggregate;
}

class PendingDeepLinkNotifier extends Notifier<PendingDeepLink?> {
  @override
  PendingDeepLink? build() => null;

  void set(PendingDeepLink? value) => state = value;
}

final pendingDeepLinkProvider =
    NotifierProvider<PendingDeepLinkNotifier, PendingDeepLink?>(
      PendingDeepLinkNotifier.new,
    );

/// Push bildirimlerinin YASAM DONGUSUNU uygulama seviyesinde yonetir -
/// `ObservationLifecycleNotifier` ile AYNI desen (bkz. docs/decisions.md
/// Faz 6 §7): ekrana/sekmeye BAGLI degil, `main.dart`da bir kez izlenir.
///
/// - Kongre secildikten SONRA, BIR KEZ (kalici bayrak, bkz.
///   `SecureStorageService.isPushPermissionRequested`) bildirim izni
///   istenir. Reddedilirse uygulama NORMAL calismaya devam eder - konum
///   izninin aksine bu ZORUNLU DEGIL (bkz. Faz 9 talimati §3, izin
///   ekranina KARISTIRILMAZ).
/// - Firebase hic YAPILANDIRILMAMISSA (`GoogleService-Info.plist` yok/
///   gecersiz) `Firebase.initializeApp()` hata firlatir - bu SESSIZCE
///   yutulur, push bildirimleri devre disi kalir, UYGULAMA COKMEZ (bkz.
///   Faz 9 talimati §3, backend `MailSender` ile ayni zarif dusme deseni).
class PushNotificationLifecycleNotifier extends Notifier<void> {
  bool _initStarted = false;

  @override
  void build() {
    ref.listen<AsyncValue<MeResponse?>>(authSessionProvider, (previous, next) {
      _maybeInitialize(next.value);
      _tryFlushPendingDeepLink();
    }, fireImmediately: true);

    ref.listen(permissionGateProvider, (_, _) => _tryFlushPendingDeepLink());
  }

  void _maybeInitialize(MeResponse? me) {
    final hasValidSession =
        me != null && !me.mustChangePassword && me.activeCongressId != null;
    // BIR KEZ baslatilir - `authSessionProvider` sekme gecisi/kabuk yeniden
    // cizimiyle tekrar tekrar tetiklenebilir (bkz. ObservationLifecycleNotifier
    // ile AYNI "NO-OP" ihtiyaci).
    if (!hasValidSession || _initStarted) return;
    _initStarted = true;
    unawaited(_initialize());
  }

  Future<void> _initialize() async {
    try {
      await Firebase.initializeApp();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[PushNotification] Firebase baslatilamadi '
          '(GoogleService-Info.plist eksik/gecersiz olabilir) - '
          'bildirimler devre disi kaldi: $e',
        );
      }
      return;
    }

    if (Platform.isIOS) {
      // Uygulama ONPLANDAYKEN bir bildirim gelirse iOS VARSAYILAN olarak
      // sistem baloncugunu GOSTERMEZ - bu olmadan kullanici hicbir sey
      // gormez. Ek bir yerel-bildirim paketi (flutter_local_notifications
      // vb.) YERINE bu resmi firebase_messaging API'si kullanilir (bkz.
      // pubspec.yaml yorumu).
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );
    }

    unawaited(_requestPermissionIfNeverAsked());
    unawaited(_registerCurrentToken());

    FirebaseMessaging.instance.onTokenRefresh.listen(_onTokenRefresh);
    // Uygulama ARKA PLANDAYKEN/ONPLANDAYKEN bir bildirime dokunulursa.
    FirebaseMessaging.onMessageOpenedApp.listen(_onMessageTapped);

    // Uygulama TAMAMEN kapaliyken bir bildirime dokunulup ACILDIYSA.
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) _onMessageTapped(initialMessage);
  }

  Future<void> _requestPermissionIfNeverAsked() async {
    final storage = ref.read(secureStorageProvider);
    if (await storage.isPushPermissionRequested()) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
    } catch (_) {
      // Sessizce gec - bildirim izni ZORUNLU degil (bkz. Faz 9 talimati §3).
    }
    await storage.savePushPermissionRequested();
  }

  Future<void> _registerCurrentToken() async {
    final storage = ref.read(secureStorageProvider);
    final deviceId = await storage.getDeviceId();
    if (deviceId == null) return;
    await ref
        .read(pushNotificationServiceProvider)
        .reRegisterCurrentTokenIfAvailable(deviceId);
  }

  Future<void> _onTokenRefresh(String token) async {
    final storage = ref.read(secureStorageProvider);
    final deviceId = await storage.getDeviceId();
    if (deviceId == null) return;
    await ref
        .read(pushNotificationServiceProvider)
        .updateTokenOnServer(token, deviceId);
  }

  void _onMessageTapped(RemoteMessage message) {
    final notificationLogId = message.data['notificationLogId'] as String?;
    if (notificationLogId != null) {
      unawaited(
        ref
            .read(pushNotificationServiceProvider)
            .markNotificationAsOpened(notificationLogId),
      );
    }

    final sessionId = message.data['sessionId'] as String?;
    ref
        .read(pendingDeepLinkProvider.notifier)
        .set(
          sessionId != null
              ? PendingDeepLink.session(sessionId)
              : const PendingDeepLink.aggregate(),
        );
    _tryFlushPendingDeepLink();
  }

  /// `route_redirect.dart`daki TAM ayni kosullar - bu sartlar saglanmadan
  /// `/session/:id`/`/program`a gidilirse, redirect mantigi bunu ANINDA
  /// gecersiz kilip login/izin/kongre-secim ekranina geri firlatir, hedef
  /// SESSIZCE kaybolur.
  bool _isRouterReady() {
    final permissionStatus = ref.read(permissionGateProvider);
    final authState = ref.read(authSessionProvider);
    final me = authState.value;
    return permissionStatus == PermissionGateStatus.sufficient &&
        !authState.isLoading &&
        !authState.hasError &&
        me != null &&
        !me.mustChangePassword &&
        me.activeCongressId != null;
  }

  void _tryFlushPendingDeepLink() {
    final pending = ref.read(pendingDeepLinkProvider);
    if (pending == null || !_isRouterReady()) return;
    ref.read(pendingDeepLinkProvider.notifier).set(null);
    final target = pending.isAggregate
        ? '/program'
        : '/session/${pending.sessionId}';
    ref.read(goRouterProvider).push(target);
  }
}

final pushNotificationLifecycleProvider =
    NotifierProvider<PushNotificationLifecycleNotifier, void>(
      PushNotificationLifecycleNotifier.new,
    );
