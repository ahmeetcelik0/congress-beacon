import { RoleMatchStatus } from '../../generated/prisma/client';
import { ProgramRoleMatchingService } from './program-role-matching.service';

function createFakePrisma() {
  return {
    user: {
      findMany: jest.fn(),
    },
    programRole: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
}

describe('ProgramRoleMatchingService.matchRole', () => {
  it('0 aday -> UNMATCHED, userId null', async () => {
    const prisma = createFakePrisma();
    prisma.user.findMany.mockResolvedValue([]);
    const service = new ProgramRoleMatchingService(prisma as never);

    const result = await service.matchRole('cong-1', 'ahmet yilmaz');

    expect(result).toEqual({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
  });

  it('1 aday -> MATCHED, userId doludur', async () => {
    const prisma = createFakePrisma();
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
    const service = new ProgramRoleMatchingService(prisma as never);

    const result = await service.matchRole('cong-1', 'sule celik');

    expect(result).toEqual({
      matchStatus: RoleMatchStatus.MATCHED,
      userId: 'user-1',
    });
  });

  it('2+ aday -> AMBIGUOUS, userId null (sessizce ilk aday SECILMEZ)', async () => {
    const prisma = createFakePrisma();
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);
    const service = new ProgramRoleMatchingService(prisma as never);

    const result = await service.matchRole('cong-1', 'mehmet kaya');

    expect(result).toEqual({
      matchStatus: RoleMatchStatus.AMBIGUOUS,
      userId: null,
    });
  });

  it('bos searchName -> sorgu atilmadan UNMATCHED', async () => {
    const prisma = createFakePrisma();
    const service = new ProgramRoleMatchingService(prisma as never);

    const result = await service.matchRole('cong-1', '');

    expect(result).toEqual({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('arama yalnizca o kongrede AKTIF kaydi olan kullanicilarla sinirlanir', async () => {
    const prisma = createFakePrisma();
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
    const service = new ProgramRoleMatchingService(prisma as never);

    await service.matchRole('cong-1', 'ahmet yilmaz');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        searchName: 'ahmet yilmaz',
        registrations: { some: { congressId: 'cong-1', isActive: true } },
      },
      select: { id: true },
    });
  });
});

describe('ProgramRoleMatchingService.rematchCongress', () => {
  it('MANUAL ve IGNORED rolleri sorgu disi birakir, sayilarini skipped olarak doner', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findMany.mockResolvedValue([
      { id: 'role-1', searchName: 'ahmet yilmaz' },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
    prisma.programRole.count.mockResolvedValue(2);
    const service = new ProgramRoleMatchingService(prisma as never);

    const summary = await service.rematchCongress('cong-1');

    const [findManyArgs] = prisma.programRole.findMany.mock.calls[0] as [
      { where: { matchStatus: { notIn: RoleMatchStatus[] } } },
    ];
    expect(findManyArgs.where.matchStatus).toEqual({
      notIn: [RoleMatchStatus.MANUAL, RoleMatchStatus.IGNORED],
    });
    expect(summary).toEqual({
      matched: 1,
      ambiguous: 0,
      unmatched: 0,
      skipped: 2,
    });
  });

  it('MANUAL/IGNORED disindaki her rolun matchStatus/userId alanini gunceller', async () => {
    const prisma = createFakePrisma();
    prisma.programRole.findMany.mockResolvedValue([
      { id: 'role-matched', searchName: 'ahmet yilmaz' },
      { id: 'role-ambiguous', searchName: 'mehmet kaya' },
      { id: 'role-unmatched', searchName: 'olmayan kisi' },
    ]);
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'user-1' }]) // ahmet yilmaz -> MATCHED
      .mockResolvedValueOnce([{ id: 'user-2' }, { id: 'user-3' }]) // mehmet kaya -> AMBIGUOUS
      .mockResolvedValueOnce([]); // olmayan kisi -> UNMATCHED
    prisma.programRole.count.mockResolvedValue(0);
    const service = new ProgramRoleMatchingService(prisma as never);

    const summary = await service.rematchCongress('cong-1');

    expect(summary).toEqual({
      matched: 1,
      ambiguous: 1,
      unmatched: 1,
      skipped: 0,
    });
    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-matched' },
      data: { matchStatus: RoleMatchStatus.MATCHED, userId: 'user-1' },
    });
    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-ambiguous' },
      data: { matchStatus: RoleMatchStatus.AMBIGUOUS, userId: null },
    });
    expect(prisma.programRole.update).toHaveBeenCalledWith({
      where: { id: 'role-unmatched' },
      data: { matchStatus: RoleMatchStatus.UNMATCHED, userId: null },
    });
  });
});

describe('ProgramRoleMatchingService.findCandidateUsers', () => {
  it('birebir eslesme varsa (AMBIGUOUS senaryosu) o adaylari doner', async () => {
    const prisma = createFakePrisma();
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', firstName: 'Mehmet', lastName: 'Kaya' },
      { id: 'user-2', firstName: 'Mehmet', lastName: 'Kaya' },
    ]);
    const service = new ProgramRoleMatchingService(prisma as never);

    const candidates = await service.findCandidateUsers(
      'cong-1',
      'mehmet kaya',
    );

    expect(candidates).toHaveLength(2);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('birebir eslesme yoksa (UNMATCHED) kelime-icerir aramasina duser', async () => {
    const prisma = createFakePrisma();
    prisma.user.findMany
      .mockResolvedValueOnce([]) // birebir arama bos
      .mockResolvedValueOnce([
        { id: 'user-1', firstName: 'Ahmet', lastName: 'Yilmazoglu' },
      ]);
    const service = new ProgramRoleMatchingService(prisma as never);

    const candidates = await service.findCandidateUsers(
      'cong-1',
      'ahmet yilmaz',
    );

    expect(candidates).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
  });

  it('bos searchName -> bos dizi, sorgu atilmaz', async () => {
    const prisma = createFakePrisma();
    const service = new ProgramRoleMatchingService(prisma as never);

    const candidates = await service.findCandidateUsers('cong-1', '');

    expect(candidates).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
