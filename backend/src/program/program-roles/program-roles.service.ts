import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramRoleMatchingService } from '../program-role-matching.service';
import { normalizeTurkishName } from '../../common/normalize-turkish-name';
import {
  RoleMatchStatus,
  ProgramRoleType,
  type Prisma,
} from '../../../generated/prisma/client';
import { CreateProgramRoleDto } from './dto/create-program-role.dto';
import { UpdateProgramRoleDto } from './dto/update-program-role.dto';
import { ProgramRolesQueryDto } from './dto/program-roles-query.dto';

export type UnmatchedNameOccurrence = {
  roleId: string;
  type: ProgramRoleType;
  sessionId: string | null;
  sessionTitle: string | null;
  presentationId: string | null;
  presentationTitle: string | null;
};

export type UnmatchedNameGroup = {
  searchName: string;
  rawName: string;
  occurrences: UnmatchedNameOccurrence[];
};

const ROLE_INCLUDE = {
  session: { select: { id: true, title: true, congressId: true } },
  presentation: {
    select: {
      id: true,
      title: true,
      session: { select: { id: true, title: true, congressId: true } },
    },
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      phoneRaw: true,
    },
  },
} as const;

type RoleWithParents = Prisma.ProgramRoleGetPayload<{
  include: typeof ROLE_INCLUDE;
}>;

@Injectable()
export class ProgramRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: ProgramRoleMatchingService,
  ) {}

  private congressIdOf(role: RoleWithParents): string {
    // sessionId/presentationId'den TAM OLARAK biri dolu olacak sekilde
    // olusturulmustur (bkz. create() dogrulamasi) - biri her zaman congressId
    // saglar.
    return (role.session?.congressId ??
      role.presentation?.session.congressId) as string;
  }

  private async resolveCongressId(
    sessionId: string | undefined,
    presentationId: string | undefined,
  ): Promise<string> {
    if (sessionId && presentationId) {
      throw new BadRequestException(
        'Rol ayni anda hem bir oturuma hem bir sunuma baglanamaz',
      );
    }
    if (sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: { congressId: true },
      });
      if (!session) throw new NotFoundException('Oturum bulunamadi');
      return session.congressId;
    }
    if (presentationId) {
      const presentation = await this.prisma.presentation.findUnique({
        where: { id: presentationId },
        select: { session: { select: { congressId: true } } },
      });
      if (!presentation) throw new NotFoundException('Sunum bulunamadi');
      return presentation.session.congressId;
    }
    throw new BadRequestException('sessionId veya presentationId zorunludur');
  }

  private async findOrThrow(id: string): Promise<RoleWithParents> {
    const role = await this.prisma.programRole.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });
    if (!role) {
      throw new NotFoundException('Rol bulunamadi');
    }
    return role;
  }

  async create(dto: CreateProgramRoleDto) {
    const congressId = await this.resolveCongressId(
      dto.sessionId,
      dto.presentationId,
    );
    const searchName = normalizeTurkishName(dto.rawName);
    const matchResult = await this.matching.matchRole(congressId, searchName);

    return this.prisma.programRole.create({
      data: {
        sessionId: dto.sessionId,
        presentationId: dto.presentationId,
        type: dto.type,
        rawName: dto.rawName,
        searchName,
        userId: matchResult.userId,
        matchStatus: matchResult.matchStatus,
      },
    });
  }

  async update(id: string, dto: UpdateProgramRoleDto) {
    const role = await this.findOrThrow(id);

    const data: Prisma.ProgramRoleUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;

    if (dto.rawName !== undefined) {
      const searchName = normalizeTurkishName(dto.rawName);
      const matchResult = await this.matching.matchRole(
        this.congressIdOf(role),
        searchName,
      );
      data.rawName = dto.rawName;
      data.searchName = searchName;
      data.matchStatus = matchResult.matchStatus;
      data.user = matchResult.userId
        ? { connect: { id: matchResult.userId } }
        : { disconnect: true };
    }

    return this.prisma.programRole.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.programRole.delete({ where: { id } });
  }

  async link(id: string, userId: string) {
    await this.findOrThrow(id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Katilimci bulunamadi');
    }
    return this.prisma.programRole.update({
      where: { id },
      data: { userId, matchStatus: RoleMatchStatus.MANUAL },
    });
  }

  async ignore(id: string) {
    await this.findOrThrow(id);
    return this.prisma.programRole.update({
      where: { id },
      data: { userId: null, matchStatus: RoleMatchStatus.IGNORED },
    });
  }

  rematch(congressId: string) {
    return this.matching.rematchCongress(congressId);
  }

  async listMatches(query: ProgramRolesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ProgramRoleWhereInput = {
      OR: [
        { session: { congressId: query.congressId } },
        { presentation: { session: { congressId: query.congressId } } },
      ],
      ...(query.status ? { matchStatus: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.programRole.findMany({
        where,
        include: ROLE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.programRole.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async candidates(id: string) {
    const role = await this.findOrThrow(id);
    return this.matching.findCandidateUsers(
      this.congressIdOf(role),
      role.searchName,
    );
  }

  // Faz 4c §4: program isimlerinden User kaydi OTOMATIK OLUSTURULMAZ (e-posta
  // yok - ne giris yapabilir ne kongre kaydi olur, ve Faz 2'nin gercek
  // katilimci listesiyle CARPISIP BELIRSIZ eslesmeler uretebilir, bkz. Faz 4c
  // talimati). Bunun yerine onay SONRASI gorunurluk raporu: hangi isim,
  // hangi oturum/sunumda, hangi rolde eslesmedi. Ayni kisi birden fazla
  // oturumda gecebilir - `searchName` (Turkce normalize edilmis) ile
  // GRUPLANIR ki ayni kisi TEK bir satirda, tum gorunumleriyle listelensin.
  // Katilimci sonradan panelden elle eklenirse `POST /admin/program-roles/rematch`
  // (Faz 4a) bu ismi otomatik yeniden eslestirir - burada YENI bir eslestirme
  // mekanizmasi KURULMAZ.
  async unmatchedNames(congressId: string): Promise<UnmatchedNameGroup[]> {
    const roles = await this.prisma.programRole.findMany({
      where: {
        matchStatus: RoleMatchStatus.UNMATCHED,
        OR: [
          { session: { congressId } },
          { presentation: { session: { congressId } } },
        ],
      },
      select: {
        id: true,
        type: true,
        rawName: true,
        searchName: true,
        createdAt: true,
        session: { select: { id: true, title: true } },
        presentation: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const groups = new Map<string, UnmatchedNameGroup>();
    for (const role of roles) {
      let group = groups.get(role.searchName);
      if (!group) {
        group = {
          searchName: role.searchName,
          rawName: role.rawName,
          occurrences: [],
        };
        groups.set(role.searchName, group);
      }
      group.occurrences.push({
        roleId: role.id,
        type: role.type,
        sessionId: role.session?.id ?? null,
        sessionTitle: role.session?.title ?? null,
        presentationId: role.presentation?.id ?? null,
        presentationTitle: role.presentation?.title ?? null,
      });
    }

    return [...groups.values()];
  }
}
