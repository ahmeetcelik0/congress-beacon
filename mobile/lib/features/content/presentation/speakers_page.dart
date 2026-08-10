import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../core/widgets/graceful_network_image.dart';
import '../../../models/mobile_content_models.dart';
import '../application/content_providers.dart';

class SpeakersPage extends ConsumerWidget {
  const SpeakersPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(speakersProvider);

    return Scaffold(
      key: WidgetKeys.speakersScreen,
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ana Konuşmacılar')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(speakersProvider.notifier).refresh(),
        child: AsyncContentView<MobileSpeakersResponse>(
          value: state,
          onRetry: () => ref.read(speakersProvider.notifier).refresh(),
          builder:
              (context, data, {required isRefreshing, required hasStaleError}) {
                if (data.speakers.isEmpty) {
                  return const EmptyContentState(
                    icon: Icons.record_voice_over_outlined,
                    message: 'Henüz ana konuşmacı bilgisi yok.',
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
                    ...data.speakers.map(
                      (speaker) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _SpeakerTile(speaker: speaker),
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

class _SpeakerTile extends StatelessWidget {
  const _SpeakerTile({required this.speaker});

  final MobileSpeaker speaker;

  String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  void _showBio(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Avatar(
                    speaker: speaker,
                    initials: _initials(speaker.fullName),
                    radius: 28,
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          speaker.fullName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                          ),
                        ),
                        if (_subtitle(speaker) != null)
                          Text(
                            _subtitle(speaker)!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (speaker.bio != null && speaker.bio!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                Flexible(
                  child: SingleChildScrollView(
                    child: Text(
                      speaker.bio!,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        height: 1.45,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String? _subtitle(MobileSpeaker speaker) {
    final parts = [
      if (speaker.institution != null && speaker.institution!.isNotEmpty)
        speaker.institution!,
      if (speaker.country != null && speaker.country!.isNotEmpty)
        speaker.country!,
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final hasBio = speaker.bio != null && speaker.bio!.isNotEmpty;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppSpacing.md),
      child: InkWell(
        onTap: hasBio ? () => _showBio(context) : null,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              _Avatar(
                speaker: speaker,
                initials: _initials(speaker.fullName),
                radius: 26,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      speaker.fullName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14.5,
                      ),
                    ),
                    if (_subtitle(speaker) != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          _subtitle(speaker)!,
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
              if (hasBio)
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

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.speaker,
    required this.initials,
    required this.radius,
  });

  final MobileSpeaker speaker;
  final String initials;
  final double radius;

  @override
  Widget build(BuildContext context) {
    if (speaker.photoUrl == null || speaker.photoUrl!.isEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.primarySoft,
        child: Text(
          initials,
          style: TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
            fontSize: radius * 0.6,
          ),
        ),
      );
    }
    return ClipOval(
      child: SizedBox(
        width: radius * 2,
        height: radius * 2,
        child: GracefulNetworkImage(
          url: speaker.photoUrl,
          fallbackIcon: Icons.person_outline_rounded,
        ),
      ),
    );
  }
}
