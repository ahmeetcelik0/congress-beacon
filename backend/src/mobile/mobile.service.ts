import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toAbsoluteUrl } from '../common/absolute-url';
import { buildEtag } from '../common/etag';
import { pickNextSession, NextSessionCandidate } from './my-next-session';
import { GetMobileProgramQueryDto } from './dto/get-mobile-program-query.dto';
import {
  Prisma,
  RoleMatchStatus,
  VenueType,
} from '../../generated/prisma/client';

// Mobil yanitlarinda ProgramRole ASLA `user` iliskisiyle JOIN edilmez -
// yalnizca skaler `userId` alani doner (bkz. Faz 5 talimati "o kullanicinin
// iletisim bilgisi donmez"). Bu `select`, kisisel veri sinirinin TEK
// dogrulama noktasi olsun diye burada merkezilestirildi - her cagiran
// kendi include/select'ini elle yazip bir alani unutma riski tasimaz.
const MOBILE_PROGRAM_ROLE_SELECT = {
  id: true,
  type: true,
  rawName: true,
  userId: true,
  matchStatus: true,
} as const;

const MOBILE_PRESENTATION_SELECT = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  abstract: true,
  roles: {
    orderBy: { displayOrder: 'asc' as const },
    select: MOBILE_PROGRAM_ROLE_SELECT,
  },
} as const;

// Faz 10: savunma derinligi - onay akisindaki `displayOrder` yazim
// hatasi (bkz. docs/decisions.md "Faz 10") duzeltildi, ama sorgu YINE DE
// `startTime`i birincil siralama anahtari yapar: dolu `startTime`i olan
// sunumlar saatlerine gore, bos olanlar dosya sirasina (`displayOrder`)
// gore siralanir. `nulls: 'last'` olmadan MySQL/Prisma NULL'lari EN
// KUCUK deger sayip basa alirdi - bu, saat bilgisi olmayan bir sunumun
// (ör. "Tartisma") saatli sunumlarin ONUNE gecmesine yol acardi.
const MOBILE_PRESENTATION_ORDER_BY = [
  { startTime: { sort: 'asc' as const, nulls: 'last' as const } },
  { displayOrder: 'asc' as const },
];

const MOBILE_SESSION_SELECT = {
  id: true,
  hallId: true,
  title: true,
  startTime: true,
  endTime: true,
  description: true,
  sessionType: true,
  dayLabel: true,
  keywords: true,
  // Faz 10: Faz 4d'de eklenen `series` alani ilk kez mobile'a acildi -
  // dolu oldugunda program ekranindaki oturum kartinda kucuk bir ust
  // etiket olarak gosterilir (bkz. program_page.dart, docs/decisions.md
  // "Faz 10").
  series: true,
  hall: { select: { id: true, name: true } },
  roles: {
    orderBy: { displayOrder: 'asc' as const },
    select: MOBILE_PROGRAM_ROLE_SELECT,
  },
  presentations: {
    orderBy: MOBILE_PRESENTATION_ORDER_BY,
    select: MOBILE_PRESENTATION_SELECT,
  },
} as const;

@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  // DEGISTIRILMEDI (Faz 5 kisiti) - TestFlight'taki mevcut surum bunu
  // kullaniyor. Yeni mobil okuma uclarindan TAMAMEN bagimsiz, guardsiz kalir.
  async getBootstrap(congressId: string) {
    const congress = await this.prisma.congress.findUnique({
      where: { id: congressId },
    });
    if (!congress) {
      throw new NotFoundException(`Congress ${congressId} bulunamadi`);
    }

    const halls = await this.prisma.hall.findMany({
      where: { congressId },
      include: {
        hallBeacons: {
          where: { isActive: true },
          include: { beacon: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      congress: {
        id: congress.id,
        name: congress.name,
        beaconUuid: congress.beaconUuid,
      },
      halls: halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        rssiThreshold: hall.rssiThreshold,
        beacons: hall.hallBeacons.map((hallBeacon) => ({
          major: hallBeacon.beacon.major,
          minor: hallBeacon.beacon.minor,
        })),
      })),
    };
  }

  // --- Faz 5: katilimci JWT'siyle erisilen okuma uclari ---
  // Hepsinde congressId İSTEMCIDEN ALINMAZ - cagiran taraf (controller)
  // bunu her zaman token'daki activeCongressId'den gecirir (bkz.
  // docs/decisions.md, Faz 5 "neden congressId istemciden alinmiyor").

  async getHome(congressId: string, userId: string) {
    const congress = await this.prisma.congress.findUniqueOrThrow({
      where: { id: congressId },
      select: {
        id: true,
        name: true,
        fullName: true,
        startDate: true,
        endDate: true,
        description: true,
        coverImageUrl: true,
      },
    });

    const [
      mainVenue,
      announcementCount,
      latestAnnouncement,
      pinnedAnnouncement,
      sponsorCount,
      speakerCount,
      venueCount,
      infoSectionCount,
      sessionCount,
      myNextSession,
    ] = await Promise.all([
      this.prisma.venue.findFirst({
        where: { congressId, type: VenueType.MAIN },
        orderBy: { displayOrder: 'asc' },
        select: { name: true },
      }),
      this.prisma.announcement.count({
        where: { congressId, publishedAt: { not: null } },
      }),
      this.prisma.announcement.findFirst({
        where: { congressId, publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      }),
      this.prisma.announcement.findFirst({
        where: { congressId, publishedAt: { not: null }, isPinned: true },
        select: { id: true },
      }),
      this.prisma.sponsor.count({ where: { congressId } }),
      this.prisma.keynoteSpeaker.count({ where: { congressId } }),
      this.prisma.venue.count({ where: { congressId } }),
      this.prisma.congressInfoSection.count({
        where: { congressId, isPublished: true },
      }),
      this.prisma.session.count({ where: { congressId } }),
      this.getMyNextSession(congressId, userId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      congress: {
        id: congress.id,
        name: congress.name,
        fullName: congress.fullName,
        startDate: congress.startDate,
        endDate: congress.endDate,
        description: congress.description,
        coverImageUrl: toAbsoluteUrl(congress.coverImageUrl),
        mainVenueName: mainVenue?.name ?? null,
      },
      counts: {
        announcements: announcementCount,
        sponsors: sponsorCount,
        speakers: speakerCount,
        venues: venueCount,
        infoSections: infoSectionCount,
        sessions: sessionCount,
      },
      // "Okunmamis" durumu SUNUCUDA tutulmaz (yeni bir okuma-durumu tablosu
      // bu fazin kapsaminda degil) - mobil, `latestPublishedAt`i kendi yerel
      // "son goruleni" ile kiyaslayarak rozet gosterip gostermeyecegine
      // KENDI karar verir (bkz. docs/decisions.md, Faz 5).
      announcements: {
        hasPinned: pinnedAnnouncement !== null,
        latestPublishedAt: latestAnnouncement?.publishedAt ?? null,
      },
      myNextSession,
    };
  }

  async getProgram(congressId: string, query: GetMobileProgramQueryDto) {
    const where = this.buildProgramWhere(congressId, query);
    const sessions = await this.prisma.session.findMany({
      where,
      select: MOBILE_SESSION_SELECT,
      orderBy: [
        { dayLabel: 'asc' },
        { startTime: 'asc' },
        { displayOrder: 'asc' },
      ],
    });

    return {
      generatedAt: new Date().toISOString(),
      sessions,
    };
  }

  // ETag, ilgili tum kayitlarin SAYISI + en buyuk updatedAt'inden turetilir
  // (bkz. common/etag.ts yorumu) - sayim, silinen satirlarin etag'i
  // degistirmesini garanti eder (yalnizca max(updatedAt) bunu kacirirdi).
  async computeProgramEtag(congressId: string): Promise<string> {
    const [sessionAgg, presentationAgg, roleAgg] = await Promise.all([
      this.prisma.session.aggregate({
        where: { congressId },
        _max: { updatedAt: true },
        _count: true,
      }),
      this.prisma.presentation.aggregate({
        where: { session: { congressId } },
        _max: { updatedAt: true },
        _count: true,
      }),
      this.prisma.programRole.aggregate({
        where: {
          OR: [
            { session: { congressId } },
            { presentation: { session: { congressId } } },
          ],
        },
        _max: { updatedAt: true },
        _count: true,
      }),
    ]);

    return buildEtag({
      sessionCount: sessionAgg._count,
      sessionMaxUpdatedAt: sessionAgg._max.updatedAt,
      presentationCount: presentationAgg._count,
      presentationMaxUpdatedAt: presentationAgg._max.updatedAt,
      roleCount: roleAgg._count,
      roleMaxUpdatedAt: roleAgg._max.updatedAt,
    });
  }

  private buildProgramWhere(
    congressId: string,
    query: GetMobileProgramQueryDto,
  ): Prisma.SessionWhereInput {
    const { day, hallId, search } = query;
    return {
      congressId,
      ...(day ? { dayLabel: day } : {}),
      ...(hallId ? { hallId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { hall: { name: { contains: search } } },
              { roles: { some: { rawName: { contains: search } } } },
              { presentations: { some: { title: { contains: search } } } },
              {
                presentations: {
                  some: { roles: { some: { rawName: { contains: search } } } },
                },
              },
            ],
          }
        : {}),
    };
  }

  // Program sekmesindeki gun sirasi PROGRAM SIRASINA gore olmali (alfabetik
  // degil - "2. Gun" "1. Gun"den once gelmemeli). Bunu SQL'de distinct+ozel
  // siralamayla yapmak yerine, tum oturumlari zaten hafif olan (yalnizca 2
  // alan) bir sorguyla zaman sirasiyla cekip ILK GORULEN sirayla JS'te
  // dedup edilir - hem basit hem dogru.
  //
  // Faz 10: NOT - mobil uygulama bu ucu CAGIRMAZ (bkz. mobile/lib/core/
  // network/api_endpoints.dart'daki BILEREK yorum, Faz 7'de gercek
  // cihazda yakalanan cevrimdisi soguk-baslangic hatasi). Gun butonlari
  // mobilde `/mobile/program`in zaten KALICI onbelleklenmis tam liste-
  // sinden turetilir. Bu uc yine de tutarlilik icin `date` alani
  // eklenerek guncellenir (baska bir istemci ileride kullanabilir),
  // ama mobil tarafta KULLANILMAZ.
  async getProgramDays(
    congressId: string,
  ): Promise<{ label: string; date: string }[]> {
    const sessions = await this.prisma.session.findMany({
      where: { congressId, dayLabel: { not: null } },
      select: { dayLabel: true, startTime: true },
      orderBy: { startTime: 'asc' },
    });

    const seen = new Set<string>();
    const days: { label: string; date: string }[] = [];
    for (const session of sessions) {
      const label = session.dayLabel;
      if (label && !seen.has(label)) {
        seen.add(label);
        days.push({
          label,
          // Gunun takvim tarihi, o etiketin ILK oturumunun baslangic
          // saatinden turetilir - kanonik semada `day.date` zorunlu ama
          // `day.label` opsiyonel oldugu icin (bkz. docs/decisions.md
          // "Faz 4d"), gercek tarih HER ZAMAN bundan hesaplanir, uretilmis
          // etikete guvenilmez.
          date: session.startTime.toISOString().slice(0, 10),
        });
      }
    }
    return days;
  }

  async getSessionDetail(congressId: string, sessionId: string) {
    // congressId'ye gore de filtrelenir - baska bir kongrenin oturum ID'sini
    // tahmin edip deneyen bir katilimci 404 alir, veri sizmaz.
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, congressId },
      select: MOBILE_SESSION_SELECT,
    });
    if (!session) {
      throw new NotFoundException('Oturum bulunamadi');
    }
    return session;
  }

  async getMyProgram(congressId: string, userId: string) {
    const candidates = await this.fetchMyProgramCandidates(congressId, userId);
    return {
      generatedAt: new Date().toISOString(),
      items: candidates.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      ),
    };
  }

  async getMyNextSession(congressId: string, userId: string) {
    const candidates = await this.fetchMyProgramCandidates(congressId, userId);
    return pickNextSession(candidates, new Date());
  }

  // /mobile/home'daki `myNextSession` ile /mobile/my-program AYNI adaylari
  // kullanir (kullanicinin MATCHED/MANUAL rolleri) - tek bir sorguda
  // toplanip iki farkli sekilde (en yakini sec / kronolojik listele)
  // kullanilir, mantik iki yerde tekrarlanmaz.
  private async fetchMyProgramCandidates(
    congressId: string,
    userId: string,
  ): Promise<NextSessionCandidate[]> {
    const roles = await this.prisma.programRole.findMany({
      where: {
        userId,
        matchStatus: { in: [RoleMatchStatus.MATCHED, RoleMatchStatus.MANUAL] },
        OR: [
          { session: { congressId } },
          { presentation: { session: { congressId } } },
        ],
      },
      select: {
        type: true,
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            hall: { select: { name: true } },
          },
        },
        presentation: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            session: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                hall: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return roles.map((role): NextSessionCandidate => {
      if (role.presentation) {
        const { session } = role.presentation;
        return {
          sessionId: session.id,
          presentationId: role.presentation.id,
          title: role.presentation.title,
          hallName: session.hall.name,
          startTime: role.presentation.startTime ?? session.startTime,
          endTime: role.presentation.endTime ?? session.endTime,
          roleType: role.type,
        };
      }
      // Prisma seviyesinde garanti edilmez (bkz. schema.prisma yorumu -
      // sessionId/presentationId tam olarak biri dolu kurali servis
      // katmaninda uygulanir, ProgramRoleService bunu zaten yaziyor) - bu
      // yuzden role.session'in burada dolu oldugundan eminiz.
      const session = role.session!;
      return {
        sessionId: session.id,
        presentationId: null,
        title: session.title,
        hallName: session.hall.name,
        startTime: session.startTime,
        endTime: session.endTime,
        roleType: role.type,
      };
    });
  }

  async getAnnouncements(congressId: string) {
    const announcements = await this.prisma.announcement.findMany({
      where: { congressId, publishedAt: { not: null } },
      select: {
        id: true,
        title: true,
        body: true,
        isPinned: true,
        publishedAt: true,
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    });

    return { generatedAt: new Date().toISOString(), announcements };
  }

  async getSponsors(congressId: string) {
    const sponsors = await this.prisma.sponsor.findMany({
      where: { congressId },
      select: {
        id: true,
        name: true,
        tier: true,
        logoUrl: true,
        websiteUrl: true,
        description: true,
      },
      orderBy: [{ tier: 'asc' }, { displayOrder: 'asc' }],
    });

    return {
      generatedAt: new Date().toISOString(),
      sponsors: sponsors.map((sponsor) => ({
        ...sponsor,
        logoUrl: toAbsoluteUrl(sponsor.logoUrl),
      })),
    };
  }

  async getSpeakers(congressId: string) {
    const speakers = await this.prisma.keynoteSpeaker.findMany({
      where: { congressId },
      select: {
        id: true,
        fullName: true,
        title: true,
        institution: true,
        country: true,
        bio: true,
        photoUrl: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      generatedAt: new Date().toISOString(),
      speakers: speakers.map((speaker) => ({
        ...speaker,
        photoUrl: toAbsoluteUrl(speaker.photoUrl),
      })),
    };
  }

  async getVenues(congressId: string) {
    const venues = await this.prisma.venue.findMany({
      where: { congressId },
      select: {
        id: true,
        type: true,
        name: true,
        address: true,
        city: true,
        phone: true,
        websiteUrl: true,
        mapUrl: true,
        latitude: true,
        longitude: true,
        description: true,
        imageUrl: true,
      },
      // VenueType enum'i schema.prisma'da BILINCLI olarak MAIN once tanimli
      // (bkz. sponsors.service.ts'deki ayni SponsorTier deseni) - `type: 'asc'`
      // dogrudan istenen "ana mekan once" sirasini verir.
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
    });

    return {
      generatedAt: new Date().toISOString(),
      venues: venues.map((venue) => ({
        ...venue,
        imageUrl: toAbsoluteUrl(venue.imageUrl),
      })),
    };
  }

  async getInfoSections(congressId: string) {
    const sections = await this.prisma.congressInfoSection.findMany({
      where: { congressId, isPublished: true },
      select: { id: true, title: true, body: true },
      orderBy: { displayOrder: 'asc' },
    });

    return { generatedAt: new Date().toISOString(), infoSections: sections };
  }
}
