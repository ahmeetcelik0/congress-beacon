import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RoleMatchStatus,
  ProgramRoleType,
} from '../../../generated/prisma/client';
import { ProgramRolesService } from './program-roles.service';

function createFakePrisma() {
  return {
    session: { findUnique: jest.fn() },
    presentation: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    programRole: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
}

function createFakeMatching(matchResult: {
  matchStatus: RoleMatchStatus;
  userId: string | null;
}) {
  return {
    matchRole: jest.fn().mockResolvedValue(matchResult),
    rematchCongress: jest.fn(),
    findCandidateUsers: jest.fn(),
  };
}

describe('ProgramRolesService.create - sessionId/presentationId dogrulamasi', () => {
  it('ikisi de gonderilirse 400 verir, hicbir sey olusturulmaz', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await expect(
      service.create({
        sessionId: 'session-1',
        presentationId: 'pres-1',
        type: ProgramRoleType.MODERATOR,
        rawName: 'Ahmet Yilmaz',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.programRole.create).not.toHaveBeenCalled();
  });

  it('ikisi de bos gelirse 400 verir', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await expect(
      service.create({
        type: ProgramRoleType.SPEAKER,
        rawName: 'Ahmet Yilmaz',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.programRole.create).not.toHaveBeenCalled();
  });

  it('yalnizca sessionId gelirse o oturumun congressId si ile eslestirme yapilir', async () => {
    const prisma = createFakePrisma();
    prisma.session.findUnique.mockResolvedValue({ congressId: 'cong-1' });
    prisma.programRole.create.mockResolvedValue({ id: 'role-1' });
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.MATCHED,
      userId: 'user-1',
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await service.create({
      sessionId: 'session-1',
      type: ProgramRoleType.MODERATOR,
      rawName: 'Prof. Dr. Ahmet Yilmaz',
    });

    expect(matching.matchRole).toHaveBeenCalledWith('cong-1', 'ahmet yilmaz');
    expect(prisma.programRole.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        presentationId: undefined,
        type: ProgramRoleType.MODERATOR,
        rawName: 'Prof. Dr. Ahmet Yilmaz',
        searchName: 'ahmet yilmaz',
        userId: 'user-1',
        matchStatus: RoleMatchStatus.MATCHED,
      },
    });
  });

  it('yalnizca presentationId gelirse sunumun oturumu uzerinden congressId cozulur', async () => {
    const prisma = createFakePrisma();
    prisma.presentation.findUnique.mockResolvedValue({
      session: { congressId: 'cong-2' },
    });
    prisma.programRole.create.mockResolvedValue({ id: 'role-1' });
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await service.create({
      presentationId: 'pres-1',
      type: ProgramRoleType.SPEAKER,
      rawName: 'Şule Çelik',
    });

    expect(matching.matchRole).toHaveBeenCalledWith('cong-2', 'sule celik');
  });

  it('var olmayan sessionId icin 404 verir', async () => {
    const prisma = createFakePrisma();
    prisma.session.findUnique.mockResolvedValue(null);
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await expect(
      service.create({
        sessionId: 'yok-oturum',
        type: ProgramRoleType.MODERATOR,
        rawName: 'Ahmet Yilmaz',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProgramRolesService.update - rawName degisince yeniden eslestirme', () => {
  function fakeRoleWithSession(congressId: string) {
    return {
      id: 'role-1',
      session: { id: 'session-1', title: 'Oturum', congressId },
      presentation: null,
      user: null,
      searchName: 'eski isim',
    };
  }

  it('rawName degismeden (yalnizca type) guncellenirse eslestirme TEKRAR CALISMAZ', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findUnique.mockResolvedValue(
      fakeRoleWithSession('cong-1'),
    );
    prisma.programRole.update.mockResolvedValue({});
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.MATCHED,
      userId: 'user-1',
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await service.update('role-1', { type: ProgramRoleType.DISCUSSANT });

    expect(matching.matchRole).not.toHaveBeenCalled();
    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: { type: ProgramRoleType.DISCUSSANT },
    });
  });

  it('rawName degisirse searchName + matchStatus + user yeniden hesaplanir', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findUnique.mockResolvedValue(
      fakeRoleWithSession('cong-1'),
    );
    prisma.programRole.update.mockResolvedValue({});
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.AMBIGUOUS,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await service.update('role-1', { rawName: 'Mehmet Kaya' });

    expect(matching.matchRole).toHaveBeenCalledWith('cong-1', 'mehmet kaya');
    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: {
        rawName: 'Mehmet Kaya',
        searchName: 'mehmet kaya',
        matchStatus: RoleMatchStatus.AMBIGUOUS,
        user: { disconnect: true },
      },
    });
  });
});

describe('ProgramRolesService.link / ignore', () => {
  it('link() var olmayan kullanici icin 404 verir', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findUnique.mockResolvedValue({
      id: 'role-1',
      session: { congressId: 'cong-1' },
      presentation: null,
    });
    prisma.user.findUnique.mockResolvedValue(null);
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await expect(
      service.link('role-1', 'yok-kullanici'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('link() matchStatus MANUAL yapar', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findUnique.mockResolvedValue({
      id: 'role-1',
      session: { congressId: 'cong-1' },
      presentation: null,
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.programRole.update.mockResolvedValue({});
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await service.link('role-1', 'user-1');

    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: { userId: 'user-1', matchStatus: RoleMatchStatus.MANUAL },
    });
  });

  it('ignore() userId null + matchStatus IGNORED yapar', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findUnique.mockResolvedValue({
      id: 'role-1',
      session: { congressId: 'cong-1' },
      presentation: null,
    });
    prisma.programRole.update.mockResolvedValue({});
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    await service.ignore('role-1');

    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: { userId: null, matchStatus: RoleMatchStatus.IGNORED },
    });
  });
});

// Faz 4c §4: onay sonrasi gorunurluk raporu - AYNI kisinin (searchName)
// birden fazla oturum/sunumdaki gorunumleri TEK bir grupta toplanir.
describe('ProgramRolesService.unmatchedNames', () => {
  it('yalnizca UNMATCHED rolleri sorgular, ayni searchName tek grupta toplanir', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findMany.mockResolvedValue([
      {
        id: 'role-1',
        type: ProgramRoleType.MODERATOR,
        rawName: 'Ahmet Yılmaz',
        searchName: 'ahmet yilmaz',
        session: { id: 'session-1', title: 'Açılış Oturumu' },
        presentation: null,
      },
      {
        id: 'role-2',
        type: ProgramRoleType.SPEAKER,
        rawName: 'Prof.Dr. Ahmet Yılmaz',
        searchName: 'ahmet yilmaz',
        session: null,
        presentation: { id: 'pres-1', title: 'Bir Sunum' },
      },
      {
        id: 'role-3',
        type: ProgramRoleType.DISCUSSANT,
        rawName: 'Zeynep Arslan',
        searchName: 'zeynep arslan',
        session: { id: 'session-2', title: 'Olgu Tartışmaları' },
        presentation: null,
      },
    ]);
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    const result = await service.unmatchedNames('cong-1');

    expect(prisma.programRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matchStatus: RoleMatchStatus.UNMATCHED,
          OR: [
            { session: { congressId: 'cong-1' } },
            { presentation: { session: { congressId: 'cong-1' } } },
          ],
        }) as unknown,
      }) as unknown,
    );

    expect(result).toHaveLength(2);
    const ahmetGroup = result.find((g) => g.searchName === 'ahmet yilmaz');
    expect(ahmetGroup?.rawName).toBe('Ahmet Yılmaz');
    expect(ahmetGroup?.occurrences).toHaveLength(2);
    expect(ahmetGroup?.occurrences).toEqual([
      expect.objectContaining({
        roleId: 'role-1',
        sessionId: 'session-1',
        sessionTitle: 'Açılış Oturumu',
        presentationId: null,
      }) as unknown,
      expect.objectContaining({
        roleId: 'role-2',
        sessionId: null,
        presentationId: 'pres-1',
        presentationTitle: 'Bir Sunum',
      }) as unknown,
    ]);

    const zeynepGroup = result.find((g) => g.searchName === 'zeynep arslan');
    expect(zeynepGroup?.occurrences).toHaveLength(1);
  });

  it('hic UNMATCHED rol yoksa bos dizi doner', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findMany.mockResolvedValue([]);
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    const service = new ProgramRolesService(prisma as never, matching as never);

    const result = await service.unmatchedNames('cong-1');

    expect(result).toEqual([]);
  });
});
