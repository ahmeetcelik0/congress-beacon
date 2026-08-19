import { PrismaService } from '../../prisma/prisma.service';
import { ProgramRoleMatchingService } from '../program-role-matching.service';
import { normalizeTurkishName } from '../../common/normalize-turkish-name';
import { matchHall, HallCandidate } from './hall-matching';
import {
  parseCanonicalDate,
  combineDateAndTime,
  timeToMinutes,
} from './derive-datetime';
import {
  ExtractionResult,
  CanonicalEvent,
  CanonicalHall,
} from './extraction-schema';
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

// LLM'in/kullanicinin dizideki isimlerini (rawName listesi) sirayla Faz
// 4a'nin mevcut eslestirme servisine gonderir - burada YENI bir eslestirme
// mantigi YAZILMAZ, `ProgramRoleMatchingService.matchRole` oldugu gibi
// cagrilir (bkz. Faz 4b talimati, Faz 4d'de DEGISMEDI).
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

// Faz 4d §2: JSON Schema'nın YAKALAYAMAYACAĞI, ÇAPRAZ-REFERANS gerektiren
// (kongre kaydı, aynı salondaki DİĞER etkinlikler gibi doğrulayıcının hiç
// görmediği veriye ihtiyaç duyan) anlamsal kontroller KASITLI olarak burada,
// `validate-extraction-result.ts`de DEĞİL - onlar upload'ı REDDETMEZ,
// yalnızca ilgili satırın `warning` alanına yazılır (bkz. docs/decisions.md
// "Faz 4d").
// `dayDate` (bkz. `parseCanonicalDate`) YEREL saat diliminde gece yarisi
// olarak kurulur (`combineDateAndTime`in `setHours` ile dogru yerel saat
// uretebilmesi icin - bkz. derive-datetime.ts). `congress.startDate`/
// `endDate` ise `congress.service.ts`de `new Date(dto.startDate)` ile,
// yani tarih-only ISO string'ler JS'te UTC gece yarisi olarak yorumlanir.
// Iki farkli saat dilimi kuralinda kurulmus Date'i DOGRUDAN karsilastirmak
// (server UTC+0 disinda calisirken) ayni takvim gunu icin bile yanlislikla
// "once/sonra" uyarisi uretir - bu yuzden kongre sinirlari, KENDI UTC
// takvim gunu bilesenleri YEREL gece yarisina cevrilerek karsilastirilir.
function toLocalMidnightFromUtcCalendarDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function buildDayRangeWarning(
  dayDate: Date | null,
  congressStartDate: Date | null,
  congressEndDate: Date | null,
): string | null {
  if (!dayDate) return null;
  if (
    congressStartDate &&
    dayDate < toLocalMidnightFromUtcCalendarDate(congressStartDate)
  ) {
    return 'Gün tarihi kongre başlangıç tarihinden önce';
  }
  if (
    congressEndDate &&
    dayDate > toLocalMidnightFromUtcCalendarDate(congressEndDate)
  ) {
    return 'Gün tarihi kongre bitiş tarihinden sonra';
  }
  return null;
}

// Ayni salonun (hall.events dizisi) icinde birbiriyle KESISEN etkinlikleri
// bulur - pairwise karsilastirma, salon basina etkinlik sayisi kucuk oldugu
// icin (bir kongre gununde bir salonda onlarca DEGIL, birkac-onlarca
// etkinlik olur) O(n^2) burada sorun degildir.
function findOverlappingEventIndexes(hall: CanonicalHall): Set<number> {
  const overlapping = new Set<number>();
  const ranges = hall.events.map((event) => ({
    start: timeToMinutes(event.startTime),
    end: timeToMinutes(event.endTime),
  }));
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) {
        overlapping.add(i);
        overlapping.add(j);
      }
    }
  }
  return overlapping;
}

function buildEventWarnings(
  hallWarning: string | null,
  dayRangeWarning: string | null,
  hasOverlap: boolean,
): string | null {
  const warnings: string[] = [];
  if (hallWarning) warnings.push(hallWarning);
  if (dayRangeWarning) warnings.push(dayRangeWarning);
  if (hasOverlap) {
    warnings.push('Aynı salonda bu etkinlikle çakışan başka bir etkinlik var');
  }
  return warnings.length ? warnings.join('; ') : null;
}

function buildItemWarning(
  event: CanonicalEvent,
  itemStartTime: string | null,
  itemEndTime: string | null,
): string | null {
  if (!itemStartTime || !itemEndTime) return null;
  const outsideRange =
    timeToMinutes(itemStartTime) < timeToMinutes(event.startTime) ||
    timeToMinutes(itemEndTime) > timeToMinutes(event.endTime);
  return outsideRange
    ? 'Öğenin saati, ait olduğu etkinliğin saat aralığının dışında'
    : null;
}

/**
 * Kanonik programin (gun -> salon -> etkinlik -> oge) hiyerarsik yapisini
 * STAGING tablolarina (ProgramImportSession -> Presentation -> Role) yazar.
 * Staging modeli KENDISI hala DUZ (flat) bir liste - her etkinlik TEK bir
 * `ProgramImportSession` satiridir, `rowOrder` TUM gunler/salonlar
 * arasinda ARTAN tek bir sira izler. Bu SECIM bilincli: onay/duzenleme/
 * salon-eslestirme akisinin TAMAMI (approveImport, excludeHallToCreate,
 * updateSessionRow vb.) zaten bu duz modele gore yazilmisti (Faz 2/4a/4c) -
 * girdi hiyerarsik hale geldi diye o akislar DEGISTIRILMEDI (bkz.
 * docs/decisions.md "Faz 4d").
 *
 * `type: "discussion"` olan ogeler de (baslik "Tartisma" olsa bile) BIR
 * Presentation olarak yazilir - programin akisinda bir yer tuttugu icin
 * atlanmaz (bkz. Faz 4d talimati §3). `type: "break"`/`"ceremony"`
 * etkinlikleri de birer oturum olarak yazilir, `sessionType` alanindan
 * (event.type'in kendisi) ayirt edilir.
 *
 * Burada YAZILAN hicbir sey canli program tablolarina (Session/Presentation/
 * ProgramRole) DOKUNMAZ - o yalnizca onay (`approveProgramImport`) adiminda
 * olur.
 */
export async function writeExtractionToStaging(
  prisma: PrismaService,
  matching: ProgramRoleMatchingService,
  importId: string,
  congressId: string,
  extraction: ExtractionResult,
  halls: HallCandidate[],
  congressStartDate: Date | null,
  congressEndDate: Date | null,
): Promise<void> {
  let rowOrder = 0;

  for (const day of extraction.days) {
    const dayDate = parseCanonicalDate(day.date);
    const dayRangeWarning = buildDayRangeWarning(
      dayDate,
      congressStartDate,
      congressEndDate,
    );

    for (const hall of day.halls) {
      const hallMatch = matchHall(hall.name, halls);
      const overlappingIndexes = findOverlappingEventIndexes(hall);

      for (const [eventIndex, event] of hall.events.entries()) {
        const startTime = dayDate
          ? combineDateAndTime(dayDate, event.startTime)
          : null;
        const endTime = dayDate
          ? combineDateAndTime(dayDate, event.endTime)
          : null;

        const title = event.title.trim() || null;
        const status = title ? ImportRowStatus.NEW : ImportRowStatus.INVALID;
        const message = title ? null : 'Başlık belgede bulunamadı';
        const warning = buildEventWarnings(
          hallMatch.warning,
          dayRangeWarning,
          overlappingIndexes.has(eventIndex),
        );

        const chairRoles = await buildRoleCreateInputs(
          matching,
          congressId,
          event.chairs,
          ProgramRoleType.MODERATOR,
        );
        const panelistRoles = await buildRoleCreateInputs(
          matching,
          congressId,
          event.panelists,
          ProgramRoleType.DISCUSSANT,
        );

        const presentationCreates: Array<{
          rowOrder: number;
          title: string | null;
          titleEn: string | null;
          code: string | null;
          rawStartTime: string | null;
          rawEndTime: string | null;
          startTime: Date | null;
          endTime: Date | null;
          warning: string | null;
          roles?: { create: RoleCreateData[] };
        }> = [];

        for (const [itemIndex, item] of event.items.entries()) {
          const itemStartTime =
            dayDate && item.startTime
              ? combineDateAndTime(dayDate, item.startTime)
              : null;
          const itemEndTime =
            dayDate && item.endTime
              ? combineDateAndTime(dayDate, item.endTime)
              : null;
          const speakerRoles = await buildRoleCreateInputs(
            matching,
            congressId,
            item.speakers,
            ProgramRoleType.SPEAKER,
          );

          presentationCreates.push({
            rowOrder: itemIndex,
            title: item.title.trim() || null,
            titleEn: null,
            code: item.code,
            rawStartTime: item.startTime,
            rawEndTime: item.endTime,
            startTime: itemStartTime,
            endTime: itemEndTime,
            warning: buildItemWarning(event, item.startTime, item.endTime),
            ...(speakerRoles.length ? { roles: { create: speakerRoles } } : {}),
          });
        }

        const eventRoles = [...chairRoles, ...panelistRoles];

        await prisma.programImportSession.create({
          data: {
            importId,
            rowOrder: rowOrder++,
            title,
            titleEn: event.titleEn,
            series: event.series,
            rawHallName: hall.name,
            hallId: hallMatch.hallId,
            dayLabel: day.label,
            rawDate: day.date,
            rawStartTime: event.startTime,
            rawEndTime: event.endTime,
            startTime,
            endTime,
            sessionType: event.type,
            keywords: event.keywords.length ? event.keywords.join(', ') : null,
            status,
            message,
            warning,
            ...(presentationCreates.length
              ? { presentations: { create: presentationCreates } }
              : {}),
            ...(eventRoles.length ? { roles: { create: eventRoles } } : {}),
          },
        });
      }
    }
  }
}
