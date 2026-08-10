import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../models/mobile_content_models.dart';
import '../../home/application/home_provider.dart';
import '../application/content_providers.dart';

class AnnouncementsPage extends ConsumerStatefulWidget {
  const AnnouncementsPage({super.key});

  @override
  ConsumerState<AnnouncementsPage> createState() => _AnnouncementsPageState();
}

class _AnnouncementsPageState extends ConsumerState<AnnouncementsPage> {
  @override
  void initState() {
    super.initState();
    // Ekran acilir acilmaz "son gorulen" damgasi guncellenir ki Ana
    // Sayfa'daki kirmizi nokta kaybolsun (bkz. Faz 7 talimati §2, §7
    // adim 10). `initState` icinde build tamamlanmadan once cagirmak
    // Riverpod'da guvenlidir - `ref.read` senkron bir eylem tetikler.
    Future.microtask(() => markAnnouncementsSeen(ref));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(announcementsProvider);

    return Scaffold(
      key: WidgetKeys.announcementsScreen,
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Duyurular')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(announcementsProvider.notifier).refresh(),
        child: AsyncContentView<MobileAnnouncementsResponse>(
          value: state,
          onRetry: () => ref.read(announcementsProvider.notifier).refresh(),
          builder:
              (context, data, {required isRefreshing, required hasStaleError}) {
                if (data.announcements.isEmpty) {
                  return const EmptyContentState(
                    icon: Icons.campaign_outlined,
                    message: 'Henüz duyuru yok.',
                  );
                }

                final pinned = data.announcements
                    .where((a) => a.isPinned)
                    .toList();
                final others = data.announcements
                    .where((a) => !a.isPinned)
                    .toList();

                return ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: [
                    StalenessLabel(
                      text: formatUpdatedAt(data.generatedAt),
                      hasStaleError: hasStaleError,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    ...pinned.map(
                      (a) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _AnnouncementCard(
                          announcement: a,
                          isPinned: true,
                        ),
                      ),
                    ),
                    ...others.map(
                      (a) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _AnnouncementCard(
                          announcement: a,
                          isPinned: false,
                        ),
                      ),
                    ),
                  ],
                );
              },
        ),
      ),
    );
  }
}

class _AnnouncementCard extends StatefulWidget {
  const _AnnouncementCard({required this.announcement, required this.isPinned});

  final MobileAnnouncement announcement;
  final bool isPinned;

  @override
  State<_AnnouncementCard> createState() => _AnnouncementCardState();
}

class _AnnouncementCardState extends State<_AnnouncementCard> {
  bool _expanded = false;

  static const _collapsedMaxLines = 3;

  @override
  Widget build(BuildContext context) {
    final announcement = widget.announcement;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: widget.isPinned ? AppColors.primarySoft : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(
          color: widget.isPinned
              ? AppColors.primary.withValues(alpha: 0.35)
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (widget.isPinned) ...[
                const Icon(
                  Icons.push_pin_rounded,
                  size: 15,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  announcement.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            formatTurkishDate(announcement.publishedAt),
            style: const TextStyle(color: AppColors.textFaint, fontSize: 12),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            announcement.body,
            maxLines: _expanded ? null : _collapsedMaxLines,
            overflow: _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13.5,
              height: 1.4,
            ),
          ),
          if (_isLikelyTruncated(announcement.body))
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: GestureDetector(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Text(
                  _expanded ? 'Daha az göster' : 'Devamını oku',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // Tam dogru bir tasma olcumu yerine (metin genisligine/font'a bagli,
  // LayoutBuilder + TextPainter gerektirirdi) basit bir sezgisel kullan:
  // 3 satirin sigdirabildigi ortalama karakter sayisinin BELIRGIN uzerinde
  // bir metin icin "Devaminı oku" gosterilir - kisa metinlerde link hic
  // cikmaz, uzun metinlerde her zaman cikar; sinirda kucuk bir yanlis
  // pozitif/negatif kabul edilebilir (yalnizca kozmetik bir link).
  bool _isLikelyTruncated(String text) => text.length > 160;
}
