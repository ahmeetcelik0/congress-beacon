import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../core/widgets/graceful_network_image.dart';
import '../../../core/widgets/role_type_chip.dart';
import '../../../models/mobile_content_models.dart';
import '../application/home_provider.dart';

/// Ana Sayfa sekmesi - `GET /mobile/home`in TEK istekte donduğu her seyi
/// gosterir (bkz. Faz 7 talimati §2). Beacon/tarama ile ilgili HICBIR
/// bilgi burada yer almaz (mutlak kisit §2).
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeState = ref.watch(homeProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ana Sayfa')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.read(homeProvider.notifier).refresh(),
          child: AsyncContentView<MobileHomeResponse>(
            value: homeState,
            onRetry: () => ref.read(homeProvider.notifier).refresh(),
            builder:
                (
                  context,
                  data, {
                  required isRefreshing,
                  required hasStaleError,
                }) {
                  return ListView(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    children: [
                      _CongressCard(congress: data.congress),
                      const SizedBox(height: AppSpacing.sm),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: StalenessLabel(
                          text: formatUpdatedAt(data.generatedAt),
                          hasStaleError: hasStaleError,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (data.myNextSession != null) ...[
                        _NextSessionCard(
                          key: WidgetKeys.homeNextSessionCard,
                          session: data.myNextSession!,
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                      Consumer(
                        builder: (context, ref, _) {
                          final hasUnseen = ref
                              .watch(announcementsHasUnseenProvider)
                              .maybeWhen(
                                data: (value) => value,
                                orElse: () => false,
                              );
                          return _ContentGrid(
                            counts: data.counts,
                            announcementsHasUnseen: hasUnseen,
                          );
                        },
                      ),
                    ],
                  );
                },
          ),
        ),
      ),
    );
  }
}

class _CongressCard extends StatelessWidget {
  const _CongressCard({required this.congress});

  final MobileHomeCongress congress;

  static const _fallbackGradient = LinearGradient(
    colors: [AppColors.primaryDark, AppColors.primary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppSpacing.md),
      child: SizedBox(
        height: 190,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (congress.coverImageUrl != null)
              GracefulNetworkImage(
                url: congress.coverImageUrl,
                fallbackIcon: Icons.photo_outlined,
              )
            else
              const DecoratedBox(
                decoration: BoxDecoration(gradient: _fallbackGradient),
              ),
            // Koyulastirici katman - metin HER gorselde okunur olmali
            // (bkz. Faz 7 talimati §2).
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.transparent, Color(0xCC0A0F24)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.35, 1],
                ),
              ),
            ),
            Positioned(
              left: AppSpacing.md,
              right: AppSpacing.md,
              bottom: AppSpacing.md,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    congress.displayName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatTurkishDateRange(
                      congress.startDate,
                      congress.endDate,
                    ),
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  if (congress.mainVenueName != null) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(
                          Icons.place_outlined,
                          size: 14,
                          color: Colors.white70,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            congress.mainVenueName!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NextSessionCard extends StatelessWidget {
  const _NextSessionCard({super.key, required this.session});

  final MobileNextSession session;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.accentSoft,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.campaign_rounded,
                size: 16,
                color: AppColors.accent,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  session.isOngoing ? 'ŞU AN DEVAM EDİYOR' : 'SIRADAKİ SUNUMUM',
                  style: const TextStyle(
                    color: AppColors.accent,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              RoleTypeChip(roleType: session.roleType),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            session.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _IconText(
                icon: Icons.schedule_rounded,
                text: formatTimeRange(session.startTime, session.endTime),
              ),
              _IconText(
                icon: Icons.meeting_room_outlined,
                text: session.hallName,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IconText extends StatelessWidget {
  const _IconText({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      ],
    );
  }
}

class _ContentGrid extends StatelessWidget {
  const _ContentGrid({
    required this.counts,
    required this.announcementsHasUnseen,
  });

  final MobileHomeCounts counts;
  final bool announcementsHasUnseen;

  @override
  Widget build(BuildContext context) {
    // Faz 10 dogrulama turu: gercek cihazda iOS "Erisilebilirlik Metin
    // Boyutlari"nin EN BUYUK kademesinde (Faz 7'nin test ettigi 1.3x'in
    // COK USTUNDE, ~3x'e kadar cikabiliyor) bu kartlarin `Flexible`+
    // `maxLines:2`+`ellipsis` korumasina RAGMEN tasip birbirine bindigi
    // bulundu - `GridView.count`in `childAspectRatio`si SABIT ve metin
    // olcegini HIC bilmiyordu, hucre yuksekligi buyumeyen bir kutuya 2
    // satirlik COK BUYUK yazi sigdirmaya calisiyordu. `childAspectRatio`
    // artik metin olcegine gore HESAPLANIYOR - normal olcekte (1.0x)
    // SONUC AYNI (1.5, gorsel degisiklik yok), yalnizca buyuk olcekte
    // hucreler orantili olarak uzuyor.
    final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
    final aspectRatio = (1.5 / textScale.clamp(1.0, 2.2)).clamp(0.85, 1.5);

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacing.sm,
      crossAxisSpacing: AppSpacing.sm,
      childAspectRatio: aspectRatio,
      children: [
        _ContentButton(
          key: WidgetKeys.homeContentButtonInfoSections,
          icon: Icons.info_outline_rounded,
          title: 'Genel Bilgi',
          count: counts.infoSections,
          onTap: () => context.push('/info-sections'),
        ),
        _ContentButton(
          key: WidgetKeys.homeContentButtonProgram,
          icon: Icons.calendar_month_rounded,
          title: 'Bilimsel Program',
          count: counts.sessions,
          // Yeni bir ekran ACILMAZ, alt sekmeye gecirir (bkz. Faz 7
          // talimati §2).
          onTap: () => context.go('/program'),
        ),
        _ContentButton(
          key: WidgetKeys.homeContentButtonVenues,
          icon: Icons.hotel_outlined,
          title: 'Otel Detayları',
          count: counts.venues,
          onTap: () => context.push('/venues'),
        ),
        _ContentButton(
          key: WidgetKeys.homeContentButtonSpeakers,
          icon: Icons.record_voice_over_outlined,
          title: 'Ana Konuşmacılar',
          count: counts.speakers,
          onTap: () => context.push('/speakers'),
        ),
        _ContentButton(
          key: WidgetKeys.homeContentButtonAnnouncements,
          icon: Icons.campaign_outlined,
          title: 'Duyurular',
          count: counts.announcements,
          showUnseenDot: announcementsHasUnseen,
          onTap: () => context.push('/announcements'),
        ),
        _ContentButton(
          key: WidgetKeys.homeContentButtonSponsors,
          icon: Icons.handshake_outlined,
          title: 'Sponsorlar',
          count: counts.sponsors,
          onTap: () => context.push('/sponsors'),
        ),
      ],
    );
  }
}

class _ContentButton extends StatelessWidget {
  const _ContentButton({
    super.key,
    required this.icon,
    required this.title,
    required this.count,
    required this.onTap,
    this.showUnseenDot = false,
  });

  final IconData icon;
  final String title;
  final int count;
  final VoidCallback onTap;
  final bool showUnseenDot;

  @override
  Widget build(BuildContext context) {
    // Sayisi sifir olan bolum SOLUK gorunur ama yine de acilabilir - boyle
    // bir bolumun HENUZ doldurulmadigini ima eder, kirik/devre disi
    // GORUNMEZ (bkz. Faz 7 talimati §2).
    final isEmpty = count == 0;

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppSpacing.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Opacity(
            opacity: isEmpty ? 0.55 : 1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: const BoxDecoration(
                        color: AppColors.accentSoft,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, color: AppColors.accent, size: 19),
                    ),
                    const Spacer(),
                    if (showUnseenDot)
                      Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                        ),
                      )
                    else
                      _CountBadge(count: count),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                // `Flexible` OLMADAN, buyuk sistem yazi olceginde 2 satira
                // saran baslik `GridView`in `childAspectRatio` ile SABITLENEN
                // yukseklikten tasip `RenderFlex overflowed` hatasi
                // veriyordu (gercek cihazda 1.3x olcekte yakalandi, bkz.
                // Faz 7 XCUITest->integration_test gecis talimati §4
                // `olceklendirme_test.dart`). `Flexible` metne yalnizca
                // KALAN alani ayirir, tasarsa bile `ellipsis` iceride
                // kalir.
                Flexible(
                  child: Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                    ),
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

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        '$count',
        style: const TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}
