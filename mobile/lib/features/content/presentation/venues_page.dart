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

class VenuesPage extends ConsumerWidget {
  const VenuesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(venuesProvider);

    return Scaffold(
      key: WidgetKeys.venuesScreen,
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Otel / Mekan Detayları')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(venuesProvider.notifier).refresh(),
        child: AsyncContentView<MobileVenuesResponse>(
          value: state,
          onRetry: () => ref.read(venuesProvider.notifier).refresh(),
          builder:
              (context, data, {required isRefreshing, required hasStaleError}) {
                if (data.venues.isEmpty) {
                  return const EmptyContentState(
                    icon: Icons.hotel_outlined,
                    message: 'Henüz mekan bilgisi yok.',
                  );
                }

                return ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: [
                    StalenessLabel(
                      text: formatUpdatedAt(data.generatedAt),
                      hasStaleError: hasStaleError,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    // Sunucu MAIN'i basa koyar (bkz. MobileVenuesResponse
                    // yorumu), burada yeniden SIRALAMA yapilmaz - yalnizca ana
                    // mekan gorsel olarak (daha buyuk kart) AYRISTIRILIR.
                    ...data.venues.map(
                      (venue) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: _VenueCard(venue: venue),
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

class _VenueCard extends StatelessWidget {
  const _VenueCard({required this.venue});

  final MobileVenue venue;

  @override
  Widget build(BuildContext context) {
    final isMain = venue.type == VenueType.main;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(
          color: isMain
              ? AppColors.primary.withValues(alpha: 0.4)
              : AppColors.border,
          width: isMain ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (venue.imageUrl != null)
            SizedBox(
              height: 140,
              width: double.infinity,
              child: GracefulNetworkImage(
                url: venue.imageUrl,
                fallbackIcon: Icons.location_city_outlined,
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (isMain)
                      Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: const Text(
                          'ANA MEKAN',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    Expanded(
                      child: Text(
                        venue.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ],
                ),
                if (venue.address != null || venue.city != null) ...[
                  const SizedBox(height: 6),
                  _InfoLine(
                    icon: Icons.place_outlined,
                    text: [
                      if (venue.address != null) venue.address!,
                      if (venue.city != null) venue.city!,
                    ].join(', '),
                  ),
                ],
                if (venue.description != null &&
                    venue.description!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    venue.description!,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13.5,
                      height: 1.4,
                    ),
                  ),
                ],
                if (venue.mapUrl != null || venue.phone != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.xs,
                    children: [
                      if (venue.mapUrl != null)
                        OutlinedButton.icon(
                          onPressed: () => openExternalUrl(venue.mapUrl!),
                          icon: const Icon(Icons.map_outlined, size: 17),
                          label: const Text('Haritada Aç'),
                        ),
                      if (venue.phone != null)
                        OutlinedButton.icon(
                          onPressed: () => openPhoneNumber(venue.phone!),
                          icon: const Icon(Icons.call_outlined, size: 17),
                          label: const Text('Ara'),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: AppColors.textSecondary),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }
}
