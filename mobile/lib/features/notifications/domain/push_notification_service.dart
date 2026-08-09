import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/device_models.dart';
import '../../../models/notification_models.dart';

class PushNotificationService {
  PushNotificationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  /// Updates the push token on the backend server.
  Future<void> updateTokenOnServer(String pushToken, String deviceId) async {
    final request = PushTokenRequest(deviceId: deviceId, pushToken: pushToken);

    try {
      await _apiClient.put(
        ApiEndpoints.pushToken,
        body: request.toJson(),
        requiresAuth: true,
      );
    } catch (e) {
      // Sadece konsol çıktısı (şimdilik) veya sessizce başarısız olabilir.
      // print yasak olduğu için yorum olarak bırakıldı.
      // Hata durumunda yeniden deneme eklenebilir.
    }
  }

  /// Marks a notification as opened on the backend server for analytics.
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
    } catch (e) {
      // Sadece konsol çıktısı (şimdilik) veya sessizce başarısız olabilir.
    }
  }

  /// Initialize Firebase messaging and listen to token refreshes.
  /// (Dummy implementation for now, will be implemented with firebase_messaging)
  Future<void> initialize(String deviceId) async {
    // TODO: Initialize Firebase
    // TODO: Request permissions
    // TODO: Get initial token and send to server
    // TODO: Listen to onTokenRefresh stream and send to server
  }
}
