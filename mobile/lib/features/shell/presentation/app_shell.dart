import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../permission/presentation/always_permission_banner.dart';

/// 3 sekmeli kabuk: Ana Sayfa · Bilimsel Program · Profilim. Hamburger
/// menü BİLEREK yok (bkz. Faz 6 talimatı §6). Kalıcı izin şeridi kabuğun
/// üstünde, tüm sekmelerde görünür kalır.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  static const _tabs = ['/home', '/program', '/profile'];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = _tabs.indexOf(location);
    return index == -1 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _currentIndex(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const AlwaysPermissionBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (index) {
          if (index == currentIndex) return;
          context.go(_tabs[index]);
        },
        // Her sekmenin HEM `icon` (secili degilken) HEM `activeIcon`
        // (seciliyken) hali AYNI Key ile sarmalanir - integration_test
        // sekmeleri metin/simge yerine kararlı bir Key ile bulup dokunabilsin
        // (bkz. core/testing/widget_keys.dart). Yalnizca `icon`a Key
        // eklemek YETMEZ: `BottomNavigationBar` secili sekme icin
        // `activeIcon`i gosterir, bu yuzden o an ZATEN secili olan bir
        // sekme (ör. Ana Sayfa'dayken tekrar Ana Sayfa'yi bulmak)
        // Key'siz kalirdi (gercek cihazda yakalanan bir hata - bkz.
        // `integration_test/olceklendirme_test.dart`). Iki hal ayni anda
        // agacta OLMADIGI icin ayni Key'in tekrarlanmasi guvenlidir.
        // `BottomNavigationBarItem`in kendisi bir widget DEGIL, `key`
        // parametresi almiyor.
        items: const [
          BottomNavigationBarItem(
            icon: KeyedSubtree(
              key: WidgetKeys.shellTabHome,
              child: Icon(Icons.home_outlined),
            ),
            activeIcon: KeyedSubtree(
              key: WidgetKeys.shellTabHome,
              child: Icon(Icons.home_rounded),
            ),
            label: 'Ana Sayfa',
          ),
          BottomNavigationBarItem(
            icon: KeyedSubtree(
              key: WidgetKeys.shellTabProgram,
              child: Icon(Icons.calendar_month_outlined),
            ),
            activeIcon: KeyedSubtree(
              key: WidgetKeys.shellTabProgram,
              child: Icon(Icons.calendar_month_rounded),
            ),
            label: 'Program',
          ),
          BottomNavigationBarItem(
            icon: KeyedSubtree(
              key: WidgetKeys.shellTabProfile,
              child: Icon(Icons.person_outline_rounded),
            ),
            activeIcon: KeyedSubtree(
              key: WidgetKeys.shellTabProfile,
              child: Icon(Icons.person_rounded),
            ),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
