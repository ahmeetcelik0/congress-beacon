import 'package:extended_image/extended_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Ag gorseli (kapak/logo/fotoğraf) icin TEK ortak sarmalayici - Faz 7
/// talimati §6 "gorsel yuklenirken yer tutucu, hata durumunda sessiz
/// dusus (kirik ikon gosterme)" kuralini tum ekranlarda (Ana Sayfa,
/// Sponsorlar, Ana Konuşmacılar, Mekanlar) TEK yerde uygular. Ag onbellegi
/// `extended_image`in `cache: true`si ile saglanir (bkz. Faz 7 talimati
/// §1, pubspec.yaml'daki paket gerekcesi).
class GracefulNetworkImage extends StatelessWidget {
  const GracefulNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.fallbackIcon = Icons.image_outlined,
    this.borderRadius = BorderRadius.zero,
  });

  final String? url;
  final BoxFit fit;
  final IconData fallbackIcon;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    final imageUrl = url;
    if (imageUrl == null || imageUrl.isEmpty) {
      return ClipRRect(
        borderRadius: borderRadius,
        child: _Fallback(icon: fallbackIcon),
      );
    }
    return ClipRRect(
      borderRadius: borderRadius,
      child: ExtendedImage.network(
        imageUrl,
        fit: fit,
        cache: true,
        loadStateChanged: (state) {
          switch (state.extendedImageLoadState) {
            case LoadState.completed:
              // null donmek "varsayilani (yuklenen goruntuyu) goster" demek.
              return null;
            case LoadState.loading:
              return _Fallback(icon: fallbackIcon, showSpinner: true);
            case LoadState.failed:
              return _Fallback(icon: fallbackIcon);
          }
        },
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.icon, this.showSpinner = false});

  final IconData icon;
  final bool showSpinner;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceMuted,
      alignment: Alignment.center,
      child: showSpinner
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon, color: AppColors.textFaint, size: 26),
    );
  }
}
