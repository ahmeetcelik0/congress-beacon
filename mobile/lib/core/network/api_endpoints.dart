/// API endpoint sabitlerini barındıran sınıf.
class ApiEndpoints {
  ApiEndpoints._();

  // Kimlik (Faz 1). `pilotLogin` backend'de duruyor (eski TestFlight surumu
  // icin) ama bu uygulama artik onu cagirmiyor - bkz. docs/decisions.md, Faz 6.
  static const String pilotLogin = '/auth/pilot-login';
  static const String registerRequest = '/auth/register-request';
  static const String login = '/auth/login';
  static const String me = '/auth/me';
  static const String changePassword = '/auth/change-password';
  static const String forgotPassword = '/auth/forgot-password';
  static const String myCongresses = '/auth/my-congresses';
  static const String selectCongress = '/auth/select-congress';

  // Cihaz + beacon (Faz 3-5, degismedi).
  static const String deviceRegister = '/devices/register';
  static const String mobileBootstrap = '/mobile/bootstrap';
  static const String observationsBatch = '/observations/batch';
  static const String pushToken = '/devices/push-token';
  static const String notificationOpened = '/notifications/opened';
}
