import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/external_link_launcher.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../models/mobile_content_models.dart';
import '../application/content_providers.dart';

class InfoSectionsPage extends ConsumerWidget {
  const InfoSectionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(infoSectionsProvider);

    return Scaffold(
      key: WidgetKeys.infoSectionsScreen,
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Genel Bilgi')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(infoSectionsProvider.notifier).refresh(),
        child: AsyncContentView<MobileInfoSectionsResponse>(
          value: state,
          onRetry: () => ref.read(infoSectionsProvider.notifier).refresh(),
          builder:
              (context, data, {required isRefreshing, required hasStaleError}) {
                if (data.infoSections.isEmpty) {
                  return const EmptyContentState(
                    icon: Icons.info_outline_rounded,
                    message: 'Henüz genel bilgi bölümü yok.',
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
                    ...data.infoSections.map(
                      (section) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: _InfoSectionCard(section: section),
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

class _InfoSectionCard extends StatelessWidget {
  const _InfoSectionCard({required this.section});

  final MobileInfoSection section;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.title,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: AppSpacing.sm),
          MarkdownBody(
            data: section.body,
            selectable: true,
            onTapLink: (text, href, title) {
              if (href != null) openExternalUrl(href);
            },
            styleSheet: MarkdownStyleSheet(
              p: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                height: 1.5,
              ),
              h1: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
              h2: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
              h3: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              strong: const TextStyle(fontWeight: FontWeight.w800),
              listBullet: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
              ),
              a: const TextStyle(
                color: AppColors.primary,
                decoration: TextDecoration.underline,
              ),
              blockquoteDecoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppSpacing.sm),
              ),
              code: const TextStyle(
                backgroundColor: AppColors.surfaceMuted,
                fontFamily: 'monospace',
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
