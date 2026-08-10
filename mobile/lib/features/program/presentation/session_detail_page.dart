import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../core/widgets/role_type_chip.dart';
import '../../../models/mobile_content_models.dart';
import '../application/program_provider.dart';

/// Oturum detayi - AYRI bir ag cagrisi (`/mobile/program/sessions/{id}`)
/// YAPILMAZ: ihtiyac duyulan her sey (roller+sunumlar dahil) zaten
/// `programProvider`in yukledigi TAM program agacinda mevcut (bkz.
/// `shared/openapi.yaml`, `MobileSession` semasi zaten `roles`/
/// `presentations` tasiyor). Bu hem gereksiz bir istegi onler hem de
/// detay ekraninin CEVRIMDISI de calismasini saglar (bkz. Faz 7 talimati
/// §7 adim 8).
class SessionDetailPage extends ConsumerWidget {
  const SessionDetailPage({super.key, required this.sessionId});

  final String sessionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final programState = ref.watch(programProvider);

    return Scaffold(
      key: WidgetKeys.sessionDetailScreen,
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Oturum Detayı')),
      body: AsyncContentView<MobileProgramResponse>(
        value: programState,
        onRetry: () => ref.read(programProvider.notifier).refresh(),
        builder:
            (context, data, {required isRefreshing, required hasStaleError}) {
              MobileSession? session;
              for (final candidate in data.sessions) {
                if (candidate.id == sessionId) {
                  session = candidate;
                  break;
                }
              }

              if (session == null) {
                return const EmptyContentState(
                  icon: Icons.search_off_rounded,
                  message: 'Oturum bulunamadı.',
                );
              }

              final moderators = session.roles
                  .where((r) => r.type == ProgramRoleType.moderator)
                  .toList();

              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  if (session.sessionType != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        session.sessionType!,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    session.title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 14,
                    runSpacing: 6,
                    children: [
                      _MetaItem(
                        icon: Icons.schedule_rounded,
                        text: formatTimeRange(
                          session.startTime,
                          session.endTime,
                        ),
                      ),
                      _MetaItem(
                        icon: Icons.meeting_room_outlined,
                        text: session.hallName,
                      ),
                      if (session.dayLabel != null)
                        _MetaItem(
                          icon: Icons.today_outlined,
                          text: session.dayLabel!,
                        ),
                    ],
                  ),
                  if (session.description != null &&
                      session.description!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      session.description!,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),
                  ],
                  if (session.keywords != null &&
                      session.keywords!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: session.keywords!
                          .split(',')
                          .map((k) => k.trim())
                          .where((k) => k.isNotEmpty)
                          .map(
                            (keyword) => Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                              ),
                              child: Text(
                                keyword,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 11.5,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  if (moderators.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.lg),
                    const _SectionTitle('Moderatörler'),
                    const SizedBox(height: AppSpacing.sm),
                    ...moderators.map(
                      (m) => _PersonRow(name: m.rawName, roleType: m.type),
                    ),
                  ],
                  if (session.presentations.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.lg),
                    const _SectionTitle('Sunumlar'),
                    const SizedBox(height: AppSpacing.sm),
                    ...session.presentations.map(
                      (presentation) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _PresentationCard(presentation: presentation),
                      ),
                    ),
                  ],
                ],
              );
            },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppColors.textSecondary),
        const SizedBox(width: 5),
        Text(
          text,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13.5,
          ),
        ),
      ],
    );
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({required this.name, required this.roleType});

  final String name;
  final ProgramRoleType roleType;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
          ),
          RoleTypeChip(roleType: roleType),
        ],
      ),
    );
  }
}

class _PresentationCard extends StatelessWidget {
  const _PresentationCard({required this.presentation});

  final MobilePresentation presentation;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (presentation.startTime != null && presentation.endTime != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                formatTimeRange(presentation.startTime!, presentation.endTime!),
                style: const TextStyle(
                  color: AppColors.textFaint,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          Text(
            presentation.title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
          ),
          if (presentation.roles.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...presentation.roles.map(
              (role) => Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        role.rawName,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    RoleTypeChip(roleType: role.type),
                  ],
                ),
              ),
            ),
          ],
          if (presentation.abstract != null &&
              presentation.abstract!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              presentation.abstract!,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
