import 'package:flutter/widgets.dart';

/// Test edilebilirlik icin merkezi widget `Key` sabitleri.
///
/// YALNIZCA `integration_test` altindaki testlerin bulmasi/dokunmasi
/// gereken oğelere eklenir - projedeki HER widget'a degil (bkz. Faz 7
/// XCUITest -> integration_test gecis talimati §3). Testler VE uretim
/// kodu AYNI sabiti kullanir ki string tekrari/yazim hatasi riski olmasin.
///
/// XCUITest'ten integration_test'e gecilmesinin sebebi: Flutter tum
/// arayuzu TEK bir `FlutterView` icine ciziyor - XCUITest widget agacini
/// GOREMEZ, yalnizca `Semantics`/`Key` ile ACIKCA verilmis accessibility
/// identifier'lari bulabilir. `integration_test` ise widget agacina
/// DOGRUDAN erisir, ek bir Xcode test target'i GEREKTIRMEZ.
class WidgetKeys {
  WidgetKeys._();

  // --- Kabuk: alt sekmeler (bkz. features/shell/presentation/app_shell.dart) ---
  static const shellTabHome = Key('shell_tab_home');
  static const shellTabProgram = Key('shell_tab_program');
  static const shellTabProfile = Key('shell_tab_profile');

  // --- Ana Sayfa (bkz. features/home/presentation/home_page.dart) ---
  static const homeNextSessionCard = Key('home_next_session_card');
  static const homeContentButtonInfoSections = Key(
    'home_content_button_info_sections',
  );
  static const homeContentButtonProgram = Key('home_content_button_program');
  static const homeContentButtonVenues = Key('home_content_button_venues');
  static const homeContentButtonSpeakers = Key('home_content_button_speakers');
  static const homeContentButtonAnnouncements = Key(
    'home_content_button_announcements',
  );
  static const homeContentButtonSponsors = Key('home_content_button_sponsors');

  // --- Bilimsel Program (bkz. features/program/presentation/program_page.dart) ---
  static const programSearchField = Key('program_search_field');
  static Key programDayTab(String day) => Key('program_day_tab_$day');
  static Key programHallFilter(String? hallId) =>
      Key('program_hall_filter_${hallId ?? 'all'}');
  static Key programSessionCard(String sessionId) =>
      Key('program_session_card_$sessionId');

  // --- Icerik ekranlarinin kok widget'lari (geri navigasyonun dogru
  // ekrana ulastigini dogrulamak icin) ---
  static const announcementsScreen = Key('announcements_screen');
  static const sponsorsScreen = Key('sponsors_screen');
  static const speakersScreen = Key('speakers_screen');
  static const venuesScreen = Key('venues_screen');
  static const infoSectionsScreen = Key('info_sections_screen');
  static const sessionDetailScreen = Key('session_detail_screen');

  // --- Profilim eylemleri (bkz. features/profile/presentation/profile_page.dart) ---
  static const profileChangeCongress = Key('profile_change_congress');
  static const profileChangePassword = Key('profile_change_password');
  static const profileLogout = Key('profile_logout');
}
