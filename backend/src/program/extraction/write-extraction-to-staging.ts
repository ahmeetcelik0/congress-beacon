import { PrismaService } from '../../prisma/prisma.service';
import { ProgramRoleMatchingService } from '../program-role-matching.service';
import { normalizeTurkishName } from '../../common/normalize-turkish-name';
import { matchHall, HallCandidate } from './hall-matching';
import {
  buildDayDateMap,
  resolveDayDate,
  combineDateAndTime,
  DayDateInfo,
} from './derive-datetime';
import { ExtractionResult } from './extraction-schema';
import {
  ImportRowStatus,
  ProgramRoleType,
  RoleMatchStatus,
} from '../../../generated/prisma/client';

type RoleCreateData = {
  type: ProgramRoleType;
  rawName: string;
  searchName: string;
  previewMatchStatus: RoleMatchStatus;
  previewUserId: string | null;
};

// LLM'in dizideki isimlerini (rawName listesi) sirayla Faz 4a'nin mevcut
// eslestirme servisine gonderir - burada YENI bir eslestirme mantigi
// YAZILMAZ, `ProgramRoleMatchingService.matchRole` oldugu gibi cagrilir
// (bkz. Faz 4b talimati).
async function buildRoleCreateInputs(
  matching: ProgramRoleMatchingService,
  congressId: string,
  rawNames: string[],
  type: ProgramRoleType,
): Promise<RoleCreateData[]> {
  const results: RoleCreateData[] = [];
  for (const rawNameCandidate of rawNames) {
    const rawName = rawNameCandidate?.trim();
    if (!rawName) continue;

    const searchName = normalizeTurkishName(rawName);
    const match = await matching.matchRole(congressId, searchName);
    results.push({
      type,
      rawName,
      searchName,
      previewMatchStatus: match.matchStatus,
      previewUserId: match.userId,
    });
  }
  return results;
}

function buildSessionWarnings(
  hallWarning: string | null,
  dayLabel: string | null,
  dayInfo: DayDateInfo,
  rawStartTime: string | null,
  rawEndTime: string | null,
): string | null {
  const warnings: string[] = [];
  if (hallWarning) warnings.push(hallWarning);

  if (!dayLabel) {
    warnings.push('Gün etiketi belgede yoktu, tarih hesaplanamadı');
  } else if (!dayInfo.date) {
    warnings.push(
      'Tarih belirlenemedi (kongre başlangıç tarihi tanımlı değil)',
    );
  } else if (dayInfo.derived) {
    warnings.push('Tarih belgede yoktu, kongre başlangıcından türetildi');
  }

  if (dayInfo.date) {
    if (!rawStartTime) warnings.push('Başlangıç saati belgede yoktu');
    if (!rawEndTime) warnings.push('Bitiş saati belgede yoktu');
  }

  return warnings.length ? warnings.join('; ') : null;
}

function buildPresentationWarning(
  dayInfo: DayDateInfo,
  rawStartTime: string | null,
  rawEndTime: string | null,
): string | null {
  if (!dayInfo.date) {
    return rawStartTime || rawEndTime
      ? 'Oturumun tarihi belirlenemediği için sunum saati hesaplanamadı'
      : null;
  }
  const warnings: string[] = [];
  if (!rawStartTime) warnings.push('Başlangıç saati belgede yoktu');
  if (!rawEndTime) warnings.push('Bitiş saati belgede yoktu');
  return warnings.length ? warnings.join('; ') : null;
}

/**
 * LLM'in ham JSON ciktisini STAGING tablolarina (ProgramImportSession ->
 * Presentation -> Role) yazar. Burada YAZILAN hicbir sey canli program
 * tablolarina (Session/Presentation/ProgramRole) DOKUNMAZ - o yalnizca
 * onay (`approveProgramImport`) adiminda olur.
 */
export async function writeExtractionToStaging(
  prisma: PrismaService,
  matching: ProgramRoleMatchingService,
  importId: string,
  congressId: string,
  extraction: ExtractionResult,
  halls: HallCandidate[],
  congressStartDate: Date | null,
): Promise<void> {
  const dayDateMap = buildDayDateMap(extraction.days, congressStartDate);

  for (const [sessionIndex, session] of extraction.sessions.entries()) {
    const dayInfo = resolveDayDate(session.dayLabel, dayDateMap);
    const startTime = combineDateAndTime(dayInfo.date, session.startTime);
    const endTime = combineDateAndTime(dayInfo.date, session.endTime);
    const hallMatch = matchHall(session.hallName, halls);
    const dayEntry = extraction.days.find((d) => d.label === session.dayLabel);

    const title = session.title?.trim() || null;
    const status = title ? ImportRowStatus.NEW : ImportRowStatus.INVALID;
    const message = title ? null : 'Başlık belgede bulunamadı';
    const warning = buildSessionWarnings(
      hallMatch.warning,
      session.dayLabel,
      dayInfo,
      session.startTime,
      session.endTime,
    );

    const moderatorRoles = await buildRoleCreateInputs(
      matching,
      congressId,
      session.moderators,
      ProgramRoleType.MODERATOR,
    );
    const discussantRoles = await buildRoleCreateInputs(
      matching,
      congressId,
      session.discussants,
      ProgramRoleType.DISCUSSANT,
    );

    const presentationCreates: Array<{
      rowOrder: number;
      title: string | null;
      rawStartTime: string | null;
      rawEndTime: string | null;
      startTime: Date | null;
      endTime: Date | null;
      warning: string | null;
      roles?: { create: RoleCreateData[] };
    }> = [];

    for (const [
      presentationIndex,
      presentation,
    ] of session.presentations.entries()) {
      const presentationStartTime = combineDateAndTime(
        dayInfo.date,
        presentation.startTime,
      );
      const presentationEndTime = combineDateAndTime(
        dayInfo.date,
        presentation.endTime,
      );
      const speakerRoles = await buildRoleCreateInputs(
        matching,
        congressId,
        presentation.speakers,
        ProgramRoleType.SPEAKER,
      );

      presentationCreates.push({
        rowOrder: presentationIndex,
        title: presentation.title?.trim() || null,
        rawStartTime: presentation.startTime,
        rawEndTime: presentation.endTime,
        startTime: presentationStartTime,
        endTime: presentationEndTime,
        warning: buildPresentationWarning(
          dayInfo,
          presentation.startTime,
          presentation.endTime,
        ),
        ...(speakerRoles.length ? { roles: { create: speakerRoles } } : {}),
      });
    }

    const sessionRoles = [...moderatorRoles, ...discussantRoles];

    await prisma.programImportSession.create({
      data: {
        importId,
        rowOrder: sessionIndex,
        title,
        rawHallName: session.hallName,
        hallId: hallMatch.hallId,
        dayLabel: session.dayLabel,
        rawDate: dayEntry?.date ?? null,
        rawStartTime: session.startTime,
        rawEndTime: session.endTime,
        startTime,
        endTime,
        sessionType: session.sessionType,
        keywords: session.keywords.length ? session.keywords.join(', ') : null,
        status,
        message,
        warning,
        ...(presentationCreates.length
          ? { presentations: { create: presentationCreates } }
          : {}),
        ...(sessionRoles.length ? { roles: { create: sessionRoles } } : {}),
      },
    });
  }
}
