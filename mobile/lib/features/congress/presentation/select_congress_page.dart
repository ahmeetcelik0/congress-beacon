import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../models/auth_models.dart';
import '../../auth/application/auth_session_provider.dart';

/// Hem ilk kongre secimi (zorunlu, `activeCongressId == null`) hem de
/// Profilim'den "Kongre Degistir" (istege bagli) icin AYNI ekran (bkz.
/// Faz 6 talimati §6).
class SelectCongressPage extends ConsumerStatefulWidget {
  const SelectCongressPage({super.key});

  @override
  ConsumerState<SelectCongressPage> createState() => _SelectCongressPageState();
}

class _SelectCongressPageState extends ConsumerState<SelectCongressPage> {
  late Future<MyCongressesResponse> _future;
  String? _selectingCongressId;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _future = ref.read(authRepositoryProvider).myCongresses();
  }

  Future<void> _select(String congressId) async {
    setState(() {
      _selectingCongressId = congressId;
      _errorMessage = null;
    });

    try {
      final response = await ref
          .read(authRepositoryProvider)
          .selectCongress(congressId);
      await ref
          .read(authSessionProvider.notifier)
          .applyNewToken(response.accessToken);
      if (!mounted) return;
      context.go('/splash');
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (_) {
      setState(() => _errorMessage = 'Beklenmeyen bir hata oluştu.');
    } finally {
      if (mounted) setState(() => _selectingCongressId = null);
    }
  }

  static const _turkishMonths = [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ];

  String _formatDate(DateTime date) {
    return '${date.day} ${_turkishMonths[date.month - 1]} ${date.year}';
  }

  String _formatDateRange(DateTime? start, DateTime? end) {
    if (start == null && end == null) return 'Tarih belirtilmemiş';
    if (start != null && end != null) {
      return '${_formatDate(start)} – ${_formatDate(end)}';
    }
    return _formatDate(start ?? end!);
  }

  @override
  Widget build(BuildContext context) {
    final currentCongressId = ref
        .watch(authSessionProvider)
        .value
        ?.activeCongressId;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Kongre Seçin'),
        automaticallyImplyLeading: currentCongressId != null,
      ),
      body: SafeArea(
        child: FutureBuilder<MyCongressesResponse>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              final message = snapshot.error is ApiException
                  ? (snapshot.error as ApiException).message
                  : 'Kongreler yüklenemedi.';
              return _MessageState(
                icon: Icons.error_outline,
                message: message,
                onRetry: () => setState(
                  () =>
                      _future = ref.read(authRepositoryProvider).myCongresses(),
                ),
              );
            }

            final congresses = snapshot.data!.congresses;
            if (congresses.isEmpty) {
              return const _MessageState(
                icon: Icons.info_outline,
                message:
                    'Bu hesapla kayıtlı aktif kongre bulunamadı.\n\nLütfen '
                    'kongre kayıt biriminizle iletişime geçin.',
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: congresses.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, index) {
                final congress = congresses[index];
                final isCurrent = congress.id == currentCongressId;
                final isSelecting = _selectingCongressId == congress.id;

                return _CongressCard(
                  congress: congress,
                  isCurrent: isCurrent,
                  isLoading: isSelecting,
                  dateRangeText: _formatDateRange(
                    congress.startDate,
                    congress.endDate,
                  ),
                  onTap: (_selectingCongressId != null || isCurrent)
                      ? null
                      : () => _select(congress.id),
                );
              },
            );
          },
        ),
      ),
      bottomNavigationBar: _errorMessage != null
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppColors.danger),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : null,
    );
  }
}

class _CongressCard extends StatelessWidget {
  const _CongressCard({
    required this.congress,
    required this.isCurrent,
    required this.isLoading,
    required this.dateRangeText,
    required this.onTap,
  });

  final AuthCongressSummary congress;
  final bool isCurrent;
  final bool isLoading;
  final String dateRangeText;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppSpacing.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.md),
            border: Border.all(
              color: isCurrent ? AppColors.primary : AppColors.border,
              width: isCurrent ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: AppColors.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.event_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      congress.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dateRangeText,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              if (isLoading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else if (isCurrent)
                const Icon(Icons.check_circle_rounded, color: AppColors.primary)
              else
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textFaint,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.message,
    this.onRetry,
  });

  final IconData icon;
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
            Icon(icon, size: 40, color: AppColors.textFaint),
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
