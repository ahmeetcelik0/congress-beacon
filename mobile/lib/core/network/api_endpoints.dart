/// API endpoint sabitlerini barındıran sınıf.
class ApiEndpoints {
  ApiEndpoints._();

  static const String pilotLogin = '/auth/pilot-login';
  static const String deviceRegister = '/devices/register';
  static const String mobileBootstrap = '/mobile/bootstrap';
  static const String observationsBatch = '/observations/batch';
  static const String pushToken = '/devices/push-token';
  static const String notificationOpened = '/notifications/opened';
}
