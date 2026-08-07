import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleMatchStatus } from '../../generated/prisma/client';

export type MatchResult = {
  matchStatus: RoleMatchStatus;
  userId: string | null;
};

export type CandidateUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
};

export type RematchSummary = {
  matched: number;
  ambiguous: number;
  unmatched: number;
  skipped: number;
};

const CANDIDATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  phoneRaw: true,
} as const;

/**
 * Bilimsel programdaki (unvanli, serbest bicimli) isimleri katilimci
 * kayitlariyla eslestirir. Yalnizca BIREBIR `searchName` esitligine bakar -
 * bulanik/benzerlik eslestirme BILINCLI olarak yok (bkz. docs/decisions.md):
 * yanlis kisiyi "senin sunumun" olarak gostermek, hic gostermemekten kotu.
 */
@Injectable()
export class ProgramRoleMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bir kongrede, verilen searchName'e birebir esit VE o kongrede aktif
   * kaydi olan katilimcilari arar. 0 aday -> UNMATCHED, 1 aday -> MATCHED,
   * 2+ aday -> AMBIGUOUS (ayni isimde iki katilimci gercek bir senaryo -
   * sessizce ilk adayi secmek yerine yetkiliye birakilir).
   */
  async matchRole(
    congressId: string,
    searchName: string,
  ): Promise<MatchResult> {
    if (!searchName) {
      return { matchStatus: RoleMatchStatus.UNMATCHED, userId: null };
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        searchName,
        registrations: { some: { congressId, isActive: true } },
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { matchStatus: RoleMatchStatus.UNMATCHED, userId: null };
    }
    if (candidates.length === 1) {
      return { matchStatus: RoleMatchStatus.MATCHED, userId: candidates[0].id };
    }
    return { matchStatus: RoleMatchStatus.AMBIGUOUS, userId: null };
  }

  /**
   * Bir kongredeki TUM rolleri yeniden eslestirir - katilimci listesi Faz
   * 2'den sonra guncellendiginde (yeni kayitlar geldiginde) calistirilir.
   * `MANUAL` ve `IGNORED` durumundaki roller BILINCLI olarak atlanir:
   * yetkilinin elle verdigi karar otomatik hesaplamayla EZILMEMELI.
   */
  async rematchCongress(congressId: string): Promise<RematchSummary> {
    const scopeFilter = {
      OR: [
        { session: { congressId } },
        { presentation: { session: { congressId } } },
      ],
    };

    const roles = await this.prisma.programRole.findMany({
      where: {
        ...scopeFilter,
        matchStatus: {
          notIn: [RoleMatchStatus.MANUAL, RoleMatchStatus.IGNORED],
        },
      },
      select: { id: true, searchName: true },
    });

    const summary: RematchSummary = {
      matched: 0,
      ambiguous: 0,
      unmatched: 0,
      skipped: 0,
    };

    for (const role of roles) {
      const result = await this.matchRole(congressId, role.searchName);
      await this.prisma.programRole.update({
        where: { id: role.id },
        data: { matchStatus: result.matchStatus, userId: result.userId },
      });

      if (result.matchStatus === RoleMatchStatus.MATCHED) summary.matched++;
      else if (result.matchStatus === RoleMatchStatus.AMBIGUOUS)
        summary.ambiguous++;
      else summary.unmatched++;
    }

    summary.skipped = await this.prisma.programRole.count({
      where: {
        ...scopeFilter,
        matchStatus: { in: [RoleMatchStatus.MANUAL, RoleMatchStatus.IGNORED] },
      },
    });

    return summary;
  }

  /**
   * Yetkilinin AMBIGUOUS/UNMATCHED bir rolu elle baglayabilmesi icin aday
   * katilimci listesi. AMBIGUOUS'ta birebir eslesen (ayni sorunu yaratan)
   * adaylar doner. UNMATCHED'te birebir eslesen KIMSE olmadigi icin daha
   * gevsek bir "kelime icerir" araması yapilir - bu yalnizca yetkiliye
   * SEÇENEK sunmak icindir, otomatik atama YAPILMAZ (bulanik eslestirme
   * kurali burada bozulmuyor).
   */
  async findCandidateUsers(
    congressId: string,
    searchName: string,
  ): Promise<CandidateUser[]> {
    if (!searchName) {
      return [];
    }

    const exact = await this.prisma.user.findMany({
      where: {
        searchName,
        registrations: { some: { congressId, isActive: true } },
      },
      select: CANDIDATE_SELECT,
    });

    if (exact.length > 0) {
      return exact;
    }

    const tokens = searchName.split(' ').filter((token) => token.length > 1);
    if (tokens.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        registrations: { some: { congressId, isActive: true } },
        OR: tokens.map((token) => ({
          searchName: { contains: token },
        })),
      },
      select: CANDIDATE_SELECT,
      take: 20,
    });
  }
}
