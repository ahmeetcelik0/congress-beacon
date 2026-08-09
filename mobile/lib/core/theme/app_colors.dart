import 'package:flutter/material.dart';

/// Uygulama genelindeki renk belirteçleri - ekranlarda sabit renk KODU
/// yazılmaz, hep buradan çağrılır (bkz. Faz 6 talimatı §3). Açık, sakin
/// bir kurumsal-sağlık paleti: koyu lacivert birincil, koyu teal ikincil
/// (bilimsel program vurguları için ayrılmış).
class AppColors {
  AppColors._();

  // Zemin
  static const Color background = Color(0xFFF5F6FB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFEEF1F8);
  static const Color border = Color(0xFFE2E6F0);

  // Marka
  static const Color primary = Color(0xFF1E4FD8);
  static const Color primaryDark = Color(0xFF15379E);
  static const Color primarySoft = Color(0xFFE7ECFB);
  static const Color accent = Color(0xFF0F766E);
  static const Color accentSoft = Color(0xFFDCF3F0);

  // Metin
  static const Color textPrimary = Color(0xFF141A33);
  static const Color textSecondary = Color(0xFF5B6178);
  static const Color textFaint = Color(0xFF9BA0B4);
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // Durum
  static const Color success = Color(0xFF15803D);
  static const Color warning = Color(0xFFB45309);
  static const Color warningSoft = Color(0xFFFEF3E2);
  static const Color danger = Color(0xFFB42318);
  static const Color dangerSoft = Color(0xFFFCEAE8);
}
