import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../auth/application/auth_session_provider.dart';

/// Uygulama açılışında izin/oturum durumu çözülene kadar gösterilir.
/// Yönlendirme mantığı (`route_redirect.dart`) bu ekrandan otomatik olarak
/// uzaklaştırır - burada yalnızca yükleniyor/hata durumunu göstermek yeterli.
class SplashPage extends ConsumerWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authSessionProvider);
    final blockReason = ref.watch(offlineBlockReasonProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: authState.hasError
              ? _ErrorRetry(
                  blockReason: blockReason,
                  onRetry: () =>
                      ref.read(authSessionProvider.notifier).refresh(),
                )
              : const CircularProgressIndicator(),
        ),
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.onRetry, this.blockReason});

  final VoidCallback onRetry;
  // Faz 7.1: onbellekte gecerli bir oturum VARKEN cevrimdisi giris
  // ozellikle bu iki sunucu-gerektiren durumdan biri yuzunden
  // engellendiyse, genel "Sunucuya bağlanılamadı" yerine daha anlasilir
  // bir mesaj gosterilir (bkz. auth_session_provider.dart
  // `OfflineBlockReason`).
  final OfflineBlockReason? blockReason;

  @override
  Widget build(BuildContext context) {
    final (title, subtitle) = switch (blockReason) {
      OfflineBlockReason.passwordChangeRequired => (
        'Şifre değişikliği gerekiyor',
        'Zorunlu şifre değişikliği için internet bağlantısı gerekir. '
            'Bağlandığınızda otomatik olarak devam edilecek.',
      ),
      OfflineBlockReason.noActiveCongress => (
        'Kongre seçimi gerekiyor',
        'Aktif kongre seçimi için internet bağlantısı gerekir. '
            'Bağlandığınızda otomatik olarak devam edilecek.',
      ),
      null => (
        'Sunucuya bağlanılamadı',
        'İnternet bağlantınızı kontrol edip tekrar deneyin.',
      ),
    };

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.wifi_off_rounded,
          size: 40,
          color: AppColors.textFaint,
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(onPressed: onRetry, child: const Text('Tekrar Dene')),
      ],
    );
  }
}
