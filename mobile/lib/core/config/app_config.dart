/// Uygulama genelindeki konfigürasyonları yöneten sınıf.
class AppConfig {
  AppConfig._();

  /// API sunucusunun temel adresi.
  /// 
  /// Gerçek cihazlarda test ederken `localhost` (127.0.0.1) adresi çalışmayacaktır.
  /// Bilgisayarınızın yerel ağ IP adresini (örn: http://192.168.1.35:3001) kullanmak için
  /// uygulamayı çalıştırırken veya derlerken şu parametreyi ekleyin:
  /// `flutter run --dart-define=API_BASE_URL=http://<IP-ADRESINIZ>:<PORT>`
  static const String _apiBaseUrlFromEnv = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// API adresinin sonundaki eğik çizgiyi (/) temizleyerek döndürür.
  static String get apiBaseUrl {
    if (_apiBaseUrlFromEnv.endsWith('/')) {
      return _apiBaseUrlFromEnv.substring(0, _apiBaseUrlFromEnv.length - 1);
    }
    return _apiBaseUrlFromEnv;
  }
}
