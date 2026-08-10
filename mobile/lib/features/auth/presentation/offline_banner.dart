import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../application/auth_session_provider.dart';

/// Kabuğun üstünde, cevrimdisi (agdan degil, yerel onbellekten acilan)
/// bir oturum gosterilirken KALICI olarak duran serit (bkz. Faz 7.1
/// talimati §4). `AlwaysPermissionBanner` ile AYNI ANDA gorunebilir -
/// `AppShell`in Column'unda art arda dizilirler, biri digerinin yerini
/// ALMAZ (bkz. app_shell.dart).
///
/// Kirmizi/turuncu bir HATA rengi KULLANILMAZ (bkz. `AppColors.warning`
/// zaten `AlwaysPermissionBanner`de kullaniliyor, ikisi ayni renkte olursa
/// ayirt edilmez) - cevrimdisi calismak bu ozelligin BASARILI sonucudur,
/// alarm degil; notr bir "bilgi" tonu (`textSecondary`/`surfaceMuted`)
/// tercih edilir.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOffline = ref.watch(isOfflineSessionProvider);
    if (!isOffline) return const SizedBox.shrink();

    final cachedAt = ref.watch(lastKnownSessionCachedAtProvider).value;

    return Container(
      key: WidgetKeys.offlineBanner,
      width: double.infinity,
      color: AppColors.surfaceMuted,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: AppColors.textSecondary,
              size: 18,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                cachedAt != null
                    ? 'Çevrimdışı · ${formatUpdatedAt(cachedAt)}'
                    : 'Çevrimdışı',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                  fontSize: 12.5,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
