import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { RegistrationImportService } from './registration-import.service';

const CONGRESS_ID = 'congress-1';

type FakeUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
  phoneLast4: string | null;
};

type FakeRow = {
  id: string;
  importId: string;
  rowNumber: number;
  rawFirstName: string | null;
  rawLastName: string | null;
  rawEmail: string | null;
  rawPhone: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  externalId: string | null;
  status: string;
  message: string | null;
  warning: string | null;
  matchedUserId: string | null;
};

type FakeImport = {
  id: string;
  congressId: string;
  status: string;
  approvedAt: Date | null;
};

type FakeRegistration = {
  id: string;
  congressId: string;
  userId: string;
  source: string;
  externalId: string | null;
  isActive: boolean;
};

// P2002 hatasi ureten bir Prisma hatasi taklidi - approveImport'un catch
// blogunun gercek Prisma sinifiyla eslesmesi icin gercek
// PrismaClientKnownRequestError kullanilir (instanceof kontrolu var).
function makeUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function createFakeEnv(options: {
  users?: FakeUser[];
  rows?: FakeRow[];
  imports?: FakeImport[];
  registrations?: FakeRegistration[];
  // Belirli bir email ile user.create cagrildiginda P2002 firlatacak kullanicilar.
  failCreateForEmails?: Set<string>;
}) {
  const users = new Map((options.users ?? []).map((u) => [u.id, { ...u }]));
  const rows = new Map((options.rows ?? []).map((r) => [r.id, { ...r }]));
  const imports = new Map((options.imports ?? []).map((i) => [i.id, { ...i }]));
  const registrations = new Map(
    (options.registrations ?? []).map((r) => [r.id, { ...r }]),
  );
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  function userModel() {
    return {
      findUnique: ({
        where,
      }: {
        where: { id?: string; email?: string; phone?: string };
      }) => {
        if (where.id) return Promise.resolve(users.get(where.id) ?? null);
        const list = [...users.values()];
        if (where.email)
          return Promise.resolve(
            list.find((u) => u.email === where.email) ?? null,
          );
        if (where.phone)
          return Promise.resolve(
            list.find((u) => u.phone === where.phone) ?? null,
          );
        return Promise.resolve(null);
      },
      create: ({ data }: { data: Partial<FakeUser> }) => {
        if (data.email && options.failCreateForEmails?.has(data.email)) {
          return Promise.reject(makeUniqueConstraintError());
        }
        const user: FakeUser = {
          id: nextId('user'),
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? null,
          phone: data.phone ?? null,
          phoneRaw: data.phoneRaw ?? null,
          phoneLast4: data.phoneLast4 ?? null,
        };
        users.set(user.id, user);
        return Promise.resolve(user);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeUser>;
      }) => {
        const user = users.get(where.id);
        if (!user) throw new Error('test setup: user yok');
        Object.assign(user, data);
        return Promise.resolve(user);
      },
    };
  }

  function congressRegistrationModel() {
    return {
      findUnique: ({
        where,
      }: {
        where: { congressId_userId?: { congressId: string; userId: string } };
      }) => {
        if (!where.congressId_userId) return Promise.resolve(null);
        const { congressId, userId } = where.congressId_userId;
        const found = [...registrations.values()].find(
          (r) => r.congressId === congressId && r.userId === userId,
        );
        return Promise.resolve(found ?? null);
      },
      create: ({ data }: { data: Partial<FakeRegistration> }) => {
        const reg: FakeRegistration = {
          id: nextId('reg'),
          congressId: data.congressId as string,
          userId: data.userId as string,
          source: (data.source as string) ?? 'MANUAL',
          externalId: data.externalId ?? null,
          isActive: true,
        };
        registrations.set(reg.id, reg);
        return Promise.resolve(reg);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRegistration>;
      }) => {
        const reg = registrations.get(where.id);
        if (!reg) throw new Error('test setup: registration yok');
        Object.assign(reg, data);
        return Promise.resolve(reg);
      },
    };
  }

  function registrationImportRowModel() {
    return {
      findMany: ({
        where,
      }: {
        where: { importId: string; status?: unknown; id?: { not: string } };
      }) => {
        let list = [...rows.values()].filter(
          (r) => r.importId === where.importId,
        );
        if (
          where.status &&
          typeof where.status === 'object' &&
          'in' in where.status
        ) {
          const allowed = (where.status as { in: string[] }).in;
          list = list.filter((r) => allowed.includes(r.status));
        }
        if (where.id?.not) {
          list = list.filter((r) => r.id !== where.id!.not);
        }
        return Promise.resolve(list.sort((a, b) => a.rowNumber - b.rowNumber));
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRow>;
      }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error('test setup: row yok');
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    };
  }

  function registrationImportModel() {
    return {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(imports.get(where.id) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeImport>;
      }) => {
        const record = imports.get(where.id);
        if (!record) throw new Error('test setup: import yok');
        Object.assign(record, data);
        return Promise.resolve(record);
      },
    };
  }

  const tx = {
    user: userModel(),
    congressRegistration: congressRegistrationModel(),
    registrationImportRow: registrationImportRowModel(),
    registrationImport: registrationImportModel(),
  };

  const prisma = {
    user: userModel(),
    congressRegistration: congressRegistrationModel(),
    registrationImportRow: registrationImportRowModel(),
    registrationImport: registrationImportModel(),
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };

  return { prisma, users, rows, imports, registrations };
}

function buildRow(overrides: Partial<FakeRow>): FakeRow {
  return {
    id: overrides.id ?? `row-${Math.random().toString(36).slice(2)}`,
    importId: 'import-1',
    rowNumber: 2,
    rawFirstName: 'Ali',
    rawLastName: 'Yilmaz',
    rawEmail: null,
    rawPhone: null,
    normalizedEmail: null,
    normalizedPhone: null,
    externalId: null,
    status: 'NEW',
    message: null,
    warning: null,
    matchedUserId: null,
    ...overrides,
  };
}

describe('RegistrationImportService.approveImport', () => {
  it('NEW satirlar icin User + CongressRegistration olusturur', async () => {
    const { prisma, users, registrations, imports } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      rows: [
        buildRow({
          id: 'row-1',
          importId: 'import-1',
          rawEmail: 'ali@example.com',
          normalizedEmail: 'ali@example.com',
          externalId: 'REG-1',
        }),
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const result = await service.approveImport('import-1');

    expect(result).toEqual({
      createdUsers: 1,
      updatedUsers: 0,
      createdRegistrations: 1,
      skipped: 0,
    });
    expect(users.size).toBe(1);
    expect(registrations.size).toBe(1);
    expect(imports.get('import-1')!.status).toBe('APPROVED');
  });

  it('MATCHED satir mevcut kullanicida BOS alanlari doldurur, DOLU olani EZMEZ', async () => {
    const { prisma, users } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      users: [
        {
          id: 'user-1',
          firstName: 'Ali',
          lastName: 'Yilmaz',
          email: 'eski@example.com',
          phone: null,
          phoneRaw: null,
          phoneLast4: null,
        },
      ],
      rows: [
        buildRow({
          id: 'row-1',
          importId: 'import-1',
          status: 'MATCHED',
          matchedUserId: 'user-1',
          normalizedEmail: 'yeni@example.com', // dolu alani EZMEMELI
          normalizedPhone: '+905321234567',
          rawPhone: '0532 123 45 67',
        }),
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const result = await service.approveImport('import-1');

    expect(result.updatedUsers).toBe(1);
    const user = users.get('user-1')!;
    expect(user.email).toBe('eski@example.com'); // degismedi
    expect(user.phone).toBe('+905321234567'); // bos oldugu icin dolduruldu
  });

  it('DUPLICATE/INVALID/EXCLUDED satirlari isleme almaz', async () => {
    const { prisma, users, registrations } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      rows: [
        buildRow({ id: 'row-1', importId: 'import-1', status: 'DUPLICATE' }),
        buildRow({ id: 'row-2', importId: 'import-1', status: 'INVALID' }),
        buildRow({ id: 'row-3', importId: 'import-1', status: 'EXCLUDED' }),
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const result = await service.approveImport('import-1');

    expect(result).toEqual({
      createdUsers: 0,
      updatedUsers: 0,
      createdRegistrations: 0,
      skipped: 0,
    });
    expect(users.size).toBe(0);
    expect(registrations.size).toBe(0);
  });

  it('phone/email unique cakismasi satiri DUPLICATE yapar, transaction devam eder', async () => {
    const { prisma, users, imports } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      rows: [
        buildRow({
          id: 'row-1',
          importId: 'import-1',
          rowNumber: 2,
          rawEmail: 'cakisan@example.com',
          normalizedEmail: 'cakisan@example.com',
        }),
        buildRow({
          id: 'row-2',
          importId: 'import-1',
          rowNumber: 3,
          rawEmail: 'temiz@example.com',
          normalizedEmail: 'temiz@example.com',
        }),
      ],
      failCreateForEmails: new Set(['cakisan@example.com']),
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const result = await service.approveImport('import-1');

    // ilk satir cakisti (skipped), ikinci satir yine de basariyla islendi -
    // transaction BOZULMADI.
    expect(result.skipped).toBe(1);
    expect(result.createdUsers).toBe(1);
    expect(users.size).toBe(1);
    expect([...users.values()][0].email).toBe('temiz@example.com');
    expect(imports.get('import-1')!.status).toBe('APPROVED');
  });

  it('DRAFT olmayan import tekrar onaylanamaz (409)', async () => {
    const { prisma } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    await expect(service.approveImport('import-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('olmayan import icin 404 doner', async () => {
    const { prisma } = createFakeEnv({});
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    await expect(service.approveImport('yok')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('RegistrationImportService.updateRow', () => {
  it('duzeltme INVALID satiri NEW yapabilir (durum yeniden hesaplanir)', async () => {
    const { prisma, rows } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      rows: [
        buildRow({
          id: 'row-1',
          importId: 'import-1',
          rawFirstName: null,
          rawLastName: null,
          status: 'INVALID',
          message: 'Ad ve soyad zorunlu',
        }),
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const updated = await service.updateRow('import-1', 'row-1', {
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'ali@example.com',
    });

    expect(updated.status).toBe('NEW');
    expect(updated.message).toBeNull();
    expect(rows.get('row-1')!.status).toBe('NEW');
  });

  it('duzeltme, kardes satirla ayni e-postaya cakisirsa DUPLICATE yapar', async () => {
    const { prisma } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      rows: [
        buildRow({
          id: 'row-1',
          importId: 'import-1',
          rawEmail: 'ali@example.com',
          normalizedEmail: 'ali@example.com',
          status: 'NEW',
        }),
        buildRow({ id: 'row-2', importId: 'import-1', status: 'INVALID' }),
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const updated = await service.updateRow('import-1', 'row-2', {
      firstName: 'Veli',
      lastName: 'Kaya',
      email: 'ali@example.com',
    });

    expect(updated.status).toBe('DUPLICATE');
  });

  it('duzeltme, DB deki mevcut kullaniciyla eslesirse MATCHED yapar', async () => {
    const { prisma } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      users: [
        {
          id: 'user-1',
          firstName: 'Ali',
          lastName: 'Yilmaz',
          email: 'ali@example.com',
          phone: null,
          phoneRaw: null,
          phoneLast4: null,
        },
      ],
      rows: [
        buildRow({ id: 'row-1', importId: 'import-1', status: 'INVALID' }),
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    const updated = await service.updateRow('import-1', 'row-1', {
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'ali@example.com',
    });

    expect(updated.status).toBe('MATCHED');
    expect(updated.matchedUserId).toBe('user-1');
  });

  it('DRAFT olmayan import satiri duzenlenemez (409)', async () => {
    const { prisma } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      ],
      rows: [buildRow({ id: 'row-1', importId: 'import-1' })],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    await expect(
      service.updateRow('import-1', 'row-1', { firstName: 'X' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RegistrationImportService.cancelImport / excludeRow', () => {
  it('DRAFT importu iptal eder', async () => {
    const { prisma, imports } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    await service.cancelImport('import-1');

    expect(imports.get('import-1')!.status).toBe('CANCELLED');
  });

  it('satiri EXCLUDED yapar', async () => {
    const { prisma, rows } = createFakeEnv({
      imports: [
        {
          id: 'import-1',
          congressId: CONGRESS_ID,
          status: 'DRAFT',
          approvedAt: null,
        },
      ],
      rows: [buildRow({ id: 'row-1', importId: 'import-1', status: 'NEW' })],
    });
    const service = new RegistrationImportService(
      prisma as never,
      null as never,
    );

    await service.excludeRow('import-1', 'row-1');

    expect(rows.get('row-1')!.status).toBe('EXCLUDED');
  });
});
