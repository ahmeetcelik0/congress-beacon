import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../observations/application/observation_lifecycle_provider.dart';
import '../../observations/domain/beacon_observation_service.dart';

/// Kabuğun üstünde, KAPATILAMAZ, konum izni "Her Zaman" (Always) değilken
/// gösterilen şerit (bkz. Faz 6 talimatı §4.4). Durumu KENDİ başına
/// SORMAZ - çalışan `BeaconObservationService`in zaten yürüttüğü
/// `_refreshAlwaysPermissionStatus()` mekanizmasının sonucunu, servisin
/// `stateStream`i her yayın yaptığında `needsAlwaysLocationPermission`
/// getter'ından okuyarak yansıtır. Bu yüzden burada AYRICA bir
/// `WidgetsBindingObserver` EKLENMEZ (bkz. §7 kısıtı - ikinci bir yaşam
/// döngüsü gözlemcisi istenmiyor).
class AlwaysPermissionBanner extends ConsumerStatefulWidget {
  const AlwaysPermissionBanner({super.key});

  @override
  ConsumerState<AlwaysPermissionBanner> createState() =>
      _AlwaysPermissionBannerState();
}

class _AlwaysPermissionBannerState
    extends ConsumerState<AlwaysPermissionBanner> {
  StreamSubscription<ObservationServiceState>? _subscription;
  BeaconObservationService? _boundService;
  bool _needsAlways = false;

  void _bind(BeaconObservationService? service) {
    if (identical(service, _boundService)) return;

    _subscription?.cancel();
    _boundService = service;
    _needsAlways = service?.needsAlwaysLocationPermission ?? false;

    _subscription = service?.stateStream.listen((_) {
      if (!mounted) return;
      setState(() {
        _needsAlways = service.needsAlwaysLocationPermission;
      });
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final service = ref.watch(observationLifecycleProvider);
    _bind(service);

    if (!_needsAlways) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      color: AppColors.warningSoft,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            const Icon(
              Icons.location_off_outlined,
              color: AppColors.warning,
              size: 20,
            ),
            const SizedBox(width: AppSpacing.sm),
            const Expanded(
              child: Text(
                'Arka planda takip için konum izninin "Her Zaman" olması gerekir',
                style: TextStyle(
                  color: AppColors.warning,
                  fontWeight: FontWeight.w600,
                  fontSize: 12.5,
                ),
              ),
            ),
            TextButton(
              onPressed: () => launchUrl(Uri.parse('app-settings:')),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.warning,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                minimumSize: Size.zero,
              ),
              child: const Text('Ayarları Aç'),
            ),
          ],
        ),
      ),
    );
  }
}
