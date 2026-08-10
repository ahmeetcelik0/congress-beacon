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

  // Mobil okuma uclari (Faz 7 - mobil ekranlar, bkz. shared/openapi.yaml
  // `Mobile` tag'i). `mobile/program/sessions/{id}` VE `mobile/program/days`
  // BILEREK burada YOK: ikisi de zaten `/mobile/program`in donduğu TAM
  // (filtresiz) `sessions[]` listesinden TURETILEBILIR (detay: id ile arama;
  // gun sekmeleri: dayLabel + startTime'a gore gruplama/siralama, bkz.
  // `features/program/presentation/program_page.dart` `_deriveDayOrder`).
  // Bu hem gereksiz istekleri onler hem de - kritik olarak - ikisinin de
  // KALICI onbellege degil AYRI (ve daha once bellek-ici) bir onbellege
  // bagli kalmasindan dogacak bir hatayi yapisal olarak imkansiz kilar:
  // uygulama yeniden kurulup CEVRIMDISI acildiginda ayri bir bellek-ici
  // onbellek BOS olurdu, gun listesi/detay bulunamaz hale gelirdi - gercek
  // cihazda tam olarak bu senaryoda yakalanan bir hataydi.
  static const String mobileHome = '/mobile/home';
  static const String mobileProgram = '/mobile/program';
  static const String mobileMyProgram = '/mobile/my-program';
  static const String mobileAnnouncements = '/mobile/announcements';
  static const String mobileSponsors = '/mobile/sponsors';
  static const String mobileSpeakers = '/mobile/speakers';
  static const String mobileVenues = '/mobile/venues';
  static const String mobileInfoSections = '/mobile/info-sections';
}
