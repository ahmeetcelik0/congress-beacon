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

/// Bir gunu temsil eder - `key` filtreleme/karsilastirma icin KULLANILAN
/// gruplama anahtari (`dayKey`, "2026-04-09"), `date` yalnizca GORUNTULEME
/// icindir (bkz. turkish_date_format.dart `dayKey`).
class _DayInfo {
  const _DayInfo(this.key, this.date);

  final String key;
  final DateTime date;
}

/// Gunleri, zaten onbellekte olan program listesinden (KRONOLOJIK, gercek
/// takvim tarihine gore) turetir - `/mobile/program/days` ucuna AYRI bir
/// cagri YAPILMAZ (bkz. Faz 7 talimati §1, `mobile/lib/core/network/
/// api_endpoints.dart`taki BILEREK yorum - cevrimdisi soguk-baslangicta
/// ayri bir bellek-ici onbellek BOS kalirdi). Faz 10: onceden gruplama
/// anahtari `session.dayLabel` (opsiyonel, kanonik semada uretilmemis
/// olabilir - bkz. docs/decisions.md "Faz 4d") idi; artik HER ZAMAN
/// gercek `startTime`den turetilen takvim gunu kullanilir - `dayLabel`
/// hic set edilmemis olsa bile dogru calisir.
List<_DayInfo> _deriveDayOrder(List<MobileSession> sessions) {
  final firstSeenByKey = <String, DateTime>{};
  for (final session in sessions) {
    final key = dayKey(session.startTime);
    firstSeenByKey.putIfAbsent(key, () => session.startTime.toLocal());
  }
  final days = [
    for (final entry in firstSeenByKey.entries) _DayInfo(entry.key, entry.value),
  ];
  days.sort((a, b) => a.date.compareTo(b.date));
  return days;
}

bool _isOngoing(MobileSession session) {
  final now = DateTime.now();
  return !now.isBefore(session.startTime) && now.isBefore(session.endTime);
}

/// Kanonik semanin `event.type` degerlerinden (bkz. docs/decisions.md "Faz
/// 4d") `break`/`ceremony`/`other` olanlar icerik tasimaz - program
/// ekraninda kucuk, ikonlu, DOKUNULAMAZ bir satir olarak gosterilir (bkz.
/// Faz 10 talimati §4, referans: ekranGörüntüleri/screen 2.png). `live_case`
/// BILEREK bu listede DEGIL - gercek bir bilimsel icerigi var, tam karta
/// hak kazanir.
bool _isMinorEvent(String? sessionType) =>
    sessionType == 'break' || sessionType == 'ceremony' || sessionType == 'other';

IconData _minorEventIcon(String? sessionType) => switch (sessionType) {
  'break' => Icons.local_cafe_outlined,
  'ceremony' => Icons.emoji_events_outlined,
  _ => Icons.info_outline_rounded,
};

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
  String? _selectedDayKey;
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
    // Faz 10 §3: gun -> saat -> salon. Tek bir gune filtrelenmis durumda
    // ilk karsilastirma her zaman esit cikar (no-op), ama arama modunda
    // (TUM gunler listede) gun siralamasinin da dogru kalmasini saglar.
    filtered.sort((a, b) {
      final byDay = dayKey(a.startTime).compareTo(dayKey(b.startTime));
      if (byDay != 0) return byDay;
      final byTime = a.startTime.compareTo(b.startTime);
      if (byTime != 0) return byTime;
      return a.hallName.compareTo(b.hallName);
    });
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
                  final todayKey = dayKey(DateTime.now());
                  final defaultDayKey = days.any((d) => d.key == todayKey)
                      ? todayKey
                      : (days.isNotEmpty ? days.first.key : null);
                  final effectiveDayKey = isSearching
                      ? null
                      : (_selectedDayKey ?? defaultDayKey);
                  _DayInfo? effectiveDayInfo;
                  for (final day in days) {
                    if (day.key == effectiveDayKey) {
                      effectiveDayInfo = day;
                      break;
                    }
                  }

                  final baseSessions = isSearching
                      ? programData.sessions
                      : programData.sessions
                            .where((s) => dayKey(s.startTime) == effectiveDayKey)
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
                          selectedDayKey: effectiveDayKey,
                          onSelect: (key) => setState(() => _selectedDayKey = key),
                        ),
                      if (halls.length > 1)
                        _HallFilter(
                          halls: halls,
                          selectedHallId: _selectedHallId,
                          onSelect: (hallId) =>
                              setState(() => _selectedHallId = hallId),
                        ),
                      // Faz 10 §3: "Tum Salonlar" secili oldugunda dahi
                      // kullanicinin hangi gune baktigi HER ZAMAN belli
                      // olsun diye sabit bir baslik - salon filtresinden
                      // BAGIMSIZ, yalnizca arama modunda gizlenir (o zaman
                      // zaten tum gunler bir arada listelenir).
                      if (!isSearching && effectiveDayInfo != null)
                        _SelectedDayHeader(day: effectiveDayInfo),
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
                                    const SizedBox(height: AppSpacing.xs),
                                itemBuilder: (context, index) {
                                  final session = sessions[index];
                                  return _TimelineRow(
                                    session: session,
                                    showDayLabel: isSearching,
                                    isLast: index == sessions.length - 1,
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

class _SelectedDayHeader extends StatelessWidget {
  const _SelectedDayHeader({required this.day});

  final _DayInfo day;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        0,
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          '${formatTurkishDate(day.date)} · ${formatTurkishWeekday(day.date)}',
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 14,
            color: AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

class _DayTabs extends StatelessWidget {
  const _DayTabs({
    required this.days,
    required this.selectedDayKey,
    required this.onSelect,
  });

  final List<_DayInfo> days;
  final String? selectedDayKey;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final day = days[index];
          final isSelected = day.key == selectedDayKey;
          return ChoiceChip(
            key: WidgetKeys.programDayTab(day.key),
            label: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  formatShortDateWithYear(day.date),
                  style: TextStyle(
                    color: isSelected ? AppColors.accent : AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
                Text(
                  formatTurkishWeekday(day.date),
                  style: TextStyle(
                    color: isSelected ? AppColors.accent : AppColors.textFaint,
                    fontWeight: FontWeight.w600,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
            selected: isSelected,
            onSelected: (_) => onSelect(day.key),
            selectedColor: AppColors.accentSoft,
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

/// Zaman cizelgesi satiri: saat sutunu + dikey cizgi/nokta + icerik.
/// `IntrinsicHeight`/`stretch` kombinasyonu, degisken yukseklikli
/// kartlarin yaninda cizginin TAM olarak satirin yuksekligi kadar
/// uzamasini saglar (bkz. Faz 10 talimati §4, referans:
/// ekranGörüntüleri/screen 2.png).
class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.session,
    required this.showDayLabel,
    required this.isLast,
    required this.onTap,
  });

  final MobileSession session;
  final bool showDayLabel;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isMinor = _isMinorEvent(session.sessionType);
    final isOngoing = _isOngoing(session);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 52,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatTime(session.startTime),
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: isOngoing ? AppColors.primary : AppColors.textPrimary,
                  ),
                ),
                Text(
                  formatTime(session.endTime),
                  style: const TextStyle(
                    color: AppColors.textFaint,
                    fontSize: 12,
                  ),
                ),
                if (showDayLabel) ...[
                  const SizedBox(height: 2),
                  Text(
                    formatShortDate(session.startTime),
                    style: const TextStyle(
                      color: AppColors.textFaint,
                      fontSize: 10,
                    ),
                  ),
                ],
              ],
            ),
          ),
          _TimelineIndicator(isOngoing: isOngoing, isMinor: isMinor, isLast: isLast),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: isMinor
                ? _MinorEventRow(session: session)
                : _SessionCard(
                    key: WidgetKeys.programSessionCard(session.id),
                    session: session,
                    isOngoing: isOngoing,
                    onTap: onTap,
                  ),
          ),
        ],
      ),
    );
  }
}

class _TimelineIndicator extends StatelessWidget {
  const _TimelineIndicator({
    required this.isOngoing,
    required this.isMinor,
    required this.isLast,
  });

  final bool isOngoing;
  final bool isMinor;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final dotColor = isOngoing
        ? AppColors.primary
        : (isMinor ? AppColors.textFaint : AppColors.accent);
    final dotSize = isOngoing ? 12.0 : 8.0;

    return SizedBox(
      width: 16,
      child: Column(
        children: [
          const SizedBox(height: 4),
          Container(
            width: dotSize,
            height: dotSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dotColor,
              border: isOngoing
                  ? Border.all(color: AppColors.primarySoft, width: 3)
                  : null,
            ),
          ),
          // Faz 10 §4: cizgi listenin SON etkinliginde KESILIR - `isLast`
          // durumunda bosluk yine ayrilir (satir yuksekligini korumak
          // icin) ama cizgi CIZILMEZ.
          Expanded(
            child: isLast
                ? const SizedBox()
                : Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    color: AppColors.border,
                  ),
          ),
        ],
      ),
    );
  }
}

/// `break`/`ceremony`/`other` turundeki kucuk etkinlikler - icerikleri
/// olmadigi icin dokunulamaz (onTap KASITLI olarak yok, InkWell/GestureDetector
/// hic sarilmadi) ve normal oturum kartindan gorsel olarak ayrisir: daha
/// alcak, daha sade, ikonlu tek satir (bkz. Faz 10 talimati §4, referans:
/// ekranGörüntüleri/screen 2.png "Kahve Molası ve Sosyalleşme").
class _MinorEventRow extends StatelessWidget {
  const _MinorEventRow({required this.session});

  final MobileSession session;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: Row(
        children: [
          Icon(
            _minorEventIcon(session.sessionType),
            size: 18,
            color: AppColors.textSecondary,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              session.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    super.key,
    required this.session,
    required this.isOngoing,
    required this.onTap,
  });

  final MobileSession session;
  final bool isOngoing;
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
            border: Border.all(
              color: isOngoing ? AppColors.primary : AppColors.border,
              width: isOngoing ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (session.series != null && session.series!.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    session.series!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textFaint,
                      fontWeight: FontWeight.w700,
                      fontSize: 10.5,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              Row(
                children: [
                  if (isOngoing)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: const Text(
                        'Şimdi',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 10.5,
                        ),
                      ),
                    ),
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
