import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Faz 7'deki TUM icerik ekranlarinin (Ana Sayfa, Program, 5 icerik listesi)
/// ortak yukleniyor/hata/tazelik desenini TEK yerde uygular - her ekran
/// kendi `.when(...)` bloğunu AYRI AYRI yazmaz (bkz. Faz 7 talimati §1
/// ruhu - onbellekleme icin istenen "tek katman" ilkesi, hata/yukleniyor
/// gosterimi icin de ayni sekilde uygulanir).
///
/// `AsyncValue.hasValue`, Riverpod'un dahili "onceki degeri sakla" davranisi
/// sayesinde hem `AsyncLoading` (arka planda yenilenirken) hem `AsyncError`
/// (yenileme basarisiz ama daha once bir deger vardi) durumlarinda da TRUE
/// olabilir - bu yuzden asil icerik `hasValue`e bakilarak gosterilir,
/// yukleniyor/hata ekranlari yalnizca GERCEKTEN gosterilecek veri
/// YOKKEN devreye girer (bkz. `cached_content_notifier.dart`daki
/// "onbellek yoksa hata yukari tasinir" mantigi).
class AsyncContentView<T> extends StatelessWidget {
  const AsyncContentView({
    super.key,
    required this.value,
    required this.builder,
    this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(
    BuildContext context,
    T data, {
    required bool isRefreshing,
    required bool hasStaleError,
  })
  builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (value.hasValue) {
      return builder(
        context,
        value.requireValue,
        isRefreshing: value.isLoading,
        hasStaleError: value.hasError,
      );
    }
    if (value.hasError) {
      return _ErrorState(
        message: _describeError(value.error),
        onRetry: onRetry,
      );
    }
    return const Center(child: CircularProgressIndicator());
  }

  static String _describeError(Object? error) {
    if (error is ApiException) return error.message;
    return 'Beklenmeyen bir hata oluştu.';
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 40,
              color: AppColors.textFaint,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Tekrar Dene'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Bos-liste durumlari icin ortak gorunum (ör. "Bu günde oturum yok",
/// "Henüz duyuru yok").
class EmptyContentState extends StatelessWidget {
  const EmptyContentState({
    super.key,
    required this.icon,
    required this.message,
  });

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: AppColors.textFaint),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Son güncelleme: ..." bandi - `hasStaleError` true ise (agdan
/// yenilenemedi ama onbellekten veri gosteriliyor) ayrica bir "çevrimdışı"
/// notu ekler. Beacon/senkronizasyon TERIMI GECMEZ (bkz. Faz 7 talimati
/// §2 mutlak kisiti - kullanici arka plandaki agdan HABERSIZ, bu yalnizca
/// GORDUGU icerigin ne kadar taze oldugunu anlatir).
class StalenessLabel extends StatelessWidget {
  const StalenessLabel({
    super.key,
    required this.text,
    this.hasStaleError = false,
  });

  final String text;
  final bool hasStaleError;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          hasStaleError ? Icons.cloud_off_rounded : Icons.schedule_rounded,
          size: 13,
          color: AppColors.textFaint,
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            hasStaleError ? '$text · çevrimdışı' : text,
            style: const TextStyle(color: AppColors.textFaint, fontSize: 12),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
