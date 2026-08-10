import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/external_link_launcher.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../core/widgets/graceful_network_image.dart';
import '../../../models/mobile_content_models.dart';
import '../application/content_providers.dart';

class SponsorsPage extends ConsumerWidget {
  const SponsorsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sponsorsProvider);

    return Scaffold(
      key: WidgetKeys.sponsorsScreen,
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Sponsorlar')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(sponsorsProvider.notifier).refresh(),
        child: AsyncContentView<MobileSponsorsResponse>(
          value: state,
          onRetry: () => ref.read(sponsorsProvider.notifier).refresh(),
          builder:
              (context, data, {required isRefreshing, required hasStaleError}) {
                if (data.sponsors.isEmpty) {
                  return const EmptyContentState(
                    icon: Icons.handshake_outlined,
                    message: 'Henüz sponsor bilgisi yok.',
                  );
                }

                // Sunucu ZATEN prestij sirasina gore doner (bkz.
                // MobileSponsorsResponse yorumu) - burada yalnizca ardisik ayni
                // kademedeki kayitlar tek bir basligin altinda GRUPLANIR,
                // yeniden SIRALAMA yapilmaz.
                final sections = <(SponsorTier, List<MobileSponsor>)>[];
                for (final sponsor in data.sponsors) {
                  if (sections.isNotEmpty && sections.last.$1 == sponsor.tier) {
                    sections.last.$2.add(sponsor);
                  } else {
                    sections.add((sponsor.tier, [sponsor]));
                  }
                }

                return ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: [
                    StalenessLabel(
                      text: formatUpdatedAt(data.generatedAt),
                      hasStaleError: hasStaleError,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    for (final section in sections) ...[
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Text(
                          section.$1.label,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            letterSpacing: 0.3,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      ...section.$2.map(
                        (sponsor) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _SponsorTile(sponsor: sponsor),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  ],
                );
              },
        ),
      ),
    );
  }
}

class _SponsorTile extends StatelessWidget {
  const _SponsorTile({required this.sponsor});

  final MobileSponsor sponsor;

  @override
  Widget build(BuildContext context) {
    final websiteUrl = sponsor.websiteUrl;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppSpacing.md),
      child: InkWell(
        onTap: websiteUrl == null ? null : () => openExternalUrl(websiteUrl),
        borderRadius: BorderRadius.circular(AppSpacing.md),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 52,
                height: 52,
                child: GracefulNetworkImage(
                  url: sponsor.logoUrl,
                  fit: BoxFit.contain,
                  fallbackIcon: Icons.business_outlined,
                  borderRadius: BorderRadius.circular(AppSpacing.sm),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sponsor.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    if (sponsor.description != null &&
                        sponsor.description!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          sponsor.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12.5,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (websiteUrl != null)
                const Icon(
                  Icons.open_in_new_rounded,
                  size: 17,
                  color: AppColors.textFaint,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
