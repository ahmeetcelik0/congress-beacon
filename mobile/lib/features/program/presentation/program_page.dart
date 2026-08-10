import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/async_content_view.dart';
import '../../../models/mobile_content_models.dart';
import '../application/program_provider.dart';

/// Gun etiketlerini, zaten onbellekte olan program listesinden (KRONOLOJIK,
/// gunun ilk oturumunun baslangic saatine gore) turetir - `/mobile/program/
/// days` ucuna AYRI bir cagri YAPILMAZ. Bu bilincli bir tasarim: o uc
/// yalnizca bellek-ici onbelleklenebilirdi (kucuk yanit, bkz. Faz 7 talimati
/// §1), ama gun sekmeleri TAM PROGRAM listesini FILTRELEMEK icin kritik bir
/// bagimlilik - uygulama yeniden kurulup CEVRIMDISI acildiginda bellek-ici
/// onbellek BOS olurdu ve gun listesi bos donerdi, bu da kalici olarak
/// onbelleklenmis (ve gercekte mevcut) TUM oturumlarin gorunmez olmasina
/// yol acardi (gercek cihazda yakalanan bir hata). Siralama backend'in
/// kendi algoritmasiyla (ilk oturumun baslangic saati) BIREBIR ayni.
List<String> _deriveDayOrder(List<MobileSession> sessions) {
  final firstStartByDay = <String, DateTime>{};
  for (final session in sessions) {
    final day = session.dayLabel;
    if (day == null) continue;
    final existing = firstStartByDay[day];
    if (existing == null || session.startTime.isBefore(existing)) {
      firstStartByDay[day] = session.startTime;
    }
  }
  final days = firstStartByDay.keys.toList();
  days.sort((a, b) => firstStartByDay[a]!.compareTo(firstStartByDay[b]!));
  return days;
}

/// Bilimsel Program sekmesi - arama TAMAMEN yerelde (bkz. Faz 7 talimati
/// §3: "Program onbellekte oldugu icin aramayi yerelde yap, her tus
/// vurusunda ag istegi atma"). Gun sekmeleri KRONOLOJIK siradadir, alfabetik
/// siralama YAPILMAZ (bkz. `_deriveDayOrder`).
class ProgramPage extends ConsumerStatefulWidget {
  const ProgramPage({super.key});

  @override
  ConsumerState<ProgramPage> createState() => _ProgramPageState();
}

class _ProgramPageState extends ConsumerState<ProgramPage> {
  final _searchController = TextEditingController();
  String _query = '';
  String? _selectedDay;
  String? _selectedHallId;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<MobileSession> _filter(List<MobileSession> sessions) {
    final normalizedQuery = _query.trim().toLowerCase();
    final filtered = sessions.where((session) {
      if (_selectedHallId != null && session.hallId != _selectedHallId) {
        return false;
      }
      if (normalizedQuery.isEmpty) return true;
      if (session.title.toLowerCase().contains(normalizedQuery)) return true;
      if (session.hallName.toLowerCase().contains(normalizedQuery)) return true;
      for (final role in session.roles) {
        if (role.rawName.toLowerCase().contains(normalizedQuery)) return true;
      }
      for (final presentation in session.presentations) {
        if (presentation.title.toLowerCase().contains(normalizedQuery)) {
          return true;
        }
        for (final role in presentation.roles) {
          if (role.rawName.toLowerCase().contains(normalizedQuery)) return true;
        }
      }
      return false;
    }).toList();
    filtered.sort((a, b) => a.startTime.compareTo(b.startTime));
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final programState = ref.watch(programProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Bilimsel Program'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: TextField(
              key: WidgetKeys.programSearchField,
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Konuşmacı, oturum veya salon ara…',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      ),
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.md),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(programProvider.notifier).refresh(),
          child: AsyncContentView<MobileProgramResponse>(
            value: programState,
            onRetry: () => ref.read(programProvider.notifier).refresh(),
            builder:
                (
                  context,
                  programData, {
                  required isRefreshing,
                  required hasStaleError,
                }) {
                  final isSearching = _query.trim().isNotEmpty;
                  final halls = <String, String>{
                    for (final s in programData.sessions) s.hallId: s.hallName,
                  };

                  final days = _deriveDayOrder(programData.sessions);
                  final effectiveDay = isSearching
                      ? null
                      : (_selectedDay ?? (days.isNotEmpty ? days.first : null));

                  final baseSessions = isSearching
                      ? programData.sessions
                      : programData.sessions
                            .where((s) => s.dayLabel == effectiveDay)
                            .toList();
                  final sessions = _filter(baseSessions);

                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                        ),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: StalenessLabel(
                            text: formatUpdatedAt(programData.generatedAt),
                            hasStaleError: hasStaleError,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (!isSearching && days.length > 1)
                        _DayTabs(
                          days: days,
                          selectedDay: effectiveDay,
                          onSelect: (day) => setState(() => _selectedDay = day),
                        ),
                      if (halls.length > 1)
                        _HallFilter(
                          halls: halls,
                          selectedHallId: _selectedHallId,
                          onSelect: (hallId) =>
                              setState(() => _selectedHallId = hallId),
                        ),
                      const SizedBox(height: AppSpacing.sm),
                      Expanded(
                        child: sessions.isEmpty
                            ? EmptyContentState(
                                icon: isSearching
                                    ? Icons.search_off_rounded
                                    : Icons.event_busy_outlined,
                                message: isSearching
                                    ? 'Aramanızla eşleşen bir oturum bulunamadı.'
                                    : 'Bu günde henüz oturum yok.',
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.md,
                                  0,
                                  AppSpacing.md,
                                  AppSpacing.lg,
                                ),
                                itemCount: sessions.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(height: AppSpacing.sm),
                                itemBuilder: (context, index) {
                                  final session = sessions[index];
                                  return _TimelineRow(
                                    key: ValueKey(session.id),
                                    session: session,
                                    showDayLabel: isSearching,
                                    onTap: () =>
                                        context.push('/session/${session.id}'),
                                  );
                                },
                              ),
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

class _DayTabs extends StatelessWidget {
  const _DayTabs({
    required this.days,
    required this.selectedDay,
    required this.onSelect,
  });

  final List<String> days;
  final String? selectedDay;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final day = days[index];
          final isSelected = day == selectedDay;
          return ChoiceChip(
            key: WidgetKeys.programDayTab(day),
            label: Text(day),
            selected: isSelected,
            onSelected: (_) => onSelect(day),
            selectedColor: AppColors.primary,
            labelStyle: TextStyle(
              color: isSelected ? Colors.white : AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
            backgroundColor: AppColors.surface,
            side: BorderSide(
              color: isSelected ? AppColors.primary : AppColors.border,
            ),
          );
        },
      ),
    );
  }
}

class _HallFilter extends StatelessWidget {
  const _HallFilter({
    required this.halls,
    required this.selectedHallId,
    required this.onSelect,
  });

  final Map<String, String> halls;
  final String? selectedHallId;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final entries = halls.entries.toList();
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.xs,
          AppSpacing.md,
          0,
        ),
        itemCount: entries.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
        itemBuilder: (context, index) {
          final isAll = index == 0;
          final isSelected = isAll
              ? selectedHallId == null
              : selectedHallId == entries[index - 1].key;
          return ChoiceChip(
            key: WidgetKeys.programHallFilter(
              isAll ? null : entries[index - 1].key,
            ),
            visualDensity: VisualDensity.compact,
            label: Text(isAll ? 'Tüm Salonlar' : entries[index - 1].value),
            selected: isSelected,
            onSelected: (_) => onSelect(isAll ? null : entries[index - 1].key),
            selectedColor: AppColors.accentSoft,
            labelStyle: TextStyle(
              color: isSelected ? AppColors.accent : AppColors.textSecondary,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
            backgroundColor: AppColors.surface,
            side: BorderSide(
              color: isSelected ? AppColors.accent : AppColors.border,
            ),
          );
        },
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    super.key,
    required this.session,
    required this.showDayLabel,
    required this.onTap,
  });

  final MobileSession session;
  final bool showDayLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 52,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                formatTime(session.startTime),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
              Text(
                formatTime(session.endTime),
                style: const TextStyle(
                  color: AppColors.textFaint,
                  fontSize: 12,
                ),
              ),
              if (showDayLabel && session.dayLabel != null) ...[
                const SizedBox(height: 2),
                Text(
                  session.dayLabel!,
                  style: const TextStyle(
                    color: AppColors.textFaint,
                    fontSize: 10,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: _SessionCard(
            key: WidgetKeys.programSessionCard(session.id),
            session: session,
            onTap: onTap,
          ),
        ),
      ],
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({super.key, required this.session, required this.onTap});

  final MobileSession session;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final names = <String>{
      for (final role in session.roles) role.rawName,
      for (final presentation in session.presentations)
        for (final role in presentation.roles) role.rawName,
    }.toList();

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
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (session.sessionType != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
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
                          fontSize: 10.5,
                        ),
                      ),
                    ),
                  const Spacer(),
                  const Icon(
                    Icons.meeting_room_outlined,
                    size: 13,
                    color: AppColors.textFaint,
                  ),
                  const SizedBox(width: 3),
                  Flexible(
                    child: Text(
                      session.hallName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textFaint,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                session.title,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14.5,
                ),
              ),
              if (names.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  names.join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
