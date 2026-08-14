import 'package:firebase_messaging/firebase_messaging.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/device_models.dart';
import '../../../models/notification_models.dart';

/// Push bildirimleri icin BACKEND'e konusan ince bir istemci - Firebase
/// SDK'sinin YASAM DONGUSU orkestrasyonu (izin isteme, token yenileme,
/// mesaj dinleyicileri, derin baglanti) burada DEGIL,
/// `PushNotificationLifecycleNotifier`de (bkz. Faz 9 - ayni ayrim
/// `BeaconObservationService`/`ObservationLifecycleNotifier` ile).
class PushNotificationService {
  PushNotificationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  /// Push token'i backend'e kaydeder (`PUT /devices/push-token`).
  Future<void> updateTokenOnServer(String pushToken, String deviceId) async {
    final request = PushTokenRequest(deviceId: deviceId, pushToken: pushToken);
    try {
      await _apiClient.put(
        ApiEndpoints.pushToken,
        body: request.toJson(),
        requiresAuth: true,
      );
    } catch (_) {
      // Sessizce basarisiz olur - bir sonraki `onTokenRefresh`/uygulama
      // acilisinda tekrar denenir, kullaniciyi ENGELLEMEZ (bkz. Faz 9
      // talimati §5).
    }
  }

  /// Cihaz kaydi Faz 6.2 kurtarma akisiyla YENILENDIGINDE (yeni `deviceId`,
  /// eski token'la ESLESMEZ) cagrilir - GUNCEL FCM token'ini alip yeni
  /// `deviceId` ile tekrar gonderir. Firebase hic baslatilmamis olabilir
  /// (izin verilmedi/yapilandirma yok) - bu durumda sessizce hicbir sey
  /// yapmaz.
  Future<void> reRegisterCurrentTokenIfAvailable(String deviceId) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await updateTokenOnServer(token, deviceId);
      }
    } catch (_) {
      // Firebase baslatilmamis/izin yok - sessizce gec.
    }
  }

  /// Bildirime dokunuldugunda acilma analitigi icin (`POST
  /// /notifications/opened`).
  Future<void> markNotificationAsOpened(String notificationLogId) async {
    final request = NotificationOpenedRequest(
      notificationLogId: notificationLogId,
    );
    try {
      await _apiClient.post(
        ApiEndpoints.notificationOpened,
        body: request.toJson(),
        requiresAuth: true,
      );
    } catch (_) {
      // Sessizce basarisiz olur - kullaniciyi ENGELLEMEZ (bkz. Faz 9
      // talimati §5 "sessizce başarısız olabilir, kullanıcıyı engellemesin").
    }
  }
}
