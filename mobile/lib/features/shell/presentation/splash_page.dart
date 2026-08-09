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

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: authState.hasError
              ? _ErrorRetry(
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
  const _ErrorRetry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.wifi_off_rounded,
          size: 40,
          color: AppColors.textFaint,
        ),
        const SizedBox(height: AppSpacing.md),
        const Text(
          'Sunucuya bağlanılamadı',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        const SizedBox(height: AppSpacing.xs),
        const Text(
          'İnternet bağlantınızı kontrol edip tekrar deneyin.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(onPressed: onRetry, child: const Text('Tekrar Dene')),
      ],
    );
  }
}
