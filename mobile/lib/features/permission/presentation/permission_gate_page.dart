import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../application/permission_gate_provider.dart';

/// Uygulama girişindeki ZORUNLU, geçilemez izin ekranı (bkz. Faz 6 talimatı
/// §4). Atlama/kapatma yok - tek eylem "İzin Ver". Metin BİLEREK teknik
/// değil: beacon/RSSI/Bluetooth gibi kelimeler geçmez, yalnızca somut amacı
/// (katılım analizleri) anlatır.
class PermissionGatePage extends ConsumerStatefulWidget {
  const PermissionGatePage({super.key});

  @override
  ConsumerState<PermissionGatePage> createState() => _PermissionGatePageState();
}

class _PermissionGatePageState extends ConsumerState<PermissionGatePage> {
  bool _isRequesting = false;
  bool _wasDenied = false;

  Future<void> _onRequestPermission() async {
    setState(() => _isRequesting = true);
    final granted = await ref
        .read(permissionGateProvider.notifier)
        .requestPermission();
    if (!mounted) return;
    setState(() {
      _isRequesting = false;
      _wasDenied = !granted;
    });
    // granted true ise route_redirect otomatik olarak buradan uzaklastirir -
    // burada elle bir navigasyon YAPILMAZ.
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Bu ekran ATLANAMAZ - geri tuşu/jesti kapatmasın.
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 92,
                  height: 92,
                  decoration: const BoxDecoration(
                    color: AppColors.primarySoft,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.location_on_rounded,
                    color: AppColors.primary,
                    size: 44,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Konum İzni Gerekiyor',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                const Text(
                  'Bu uygulamayı kullanabilmek için konum izni gerekiyor. '
                  'Kongre salonlarındaki katılım analizleri için konumunuz '
                  'uygulama kapalıyken de kullanılır.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: AppSpacing.xl),
                if (_wasDenied) ...[
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(AppSpacing.sm),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'İzin verilmedi',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.warning,
                          ),
                        ),
                        SizedBox(height: AppSpacing.xs),
                        Text(
                          'Devam edebilmek için Ayarlar\'dan konum iznini açmanız '
                          'gerekiyor.',
                          style: TextStyle(color: AppColors.warning),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  OutlinedButton.icon(
                    onPressed: () => launchUrl(Uri.parse('app-settings:')),
                    icon: const Icon(Icons.settings_outlined),
                    label: const Text('Ayarları Aç'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isRequesting ? null : _onRequestPermission,
                    child: _isRequesting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('İzin Ver'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
