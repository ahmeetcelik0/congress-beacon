import { hash, compare } from 'bcryptjs';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, JwtPayload } from './auth.service';
import type { AuthenticatedUser } from './authenticated-request';

type FakeUser = {
  id: string;
  firstName: string;
  lastName: string;
  phoneLast4: string | null;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  role: string;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

type FakeRegistration = {
  id: string;
  userId: string;
  congressId: string;
  isActive: boolean;
  registeredAt: Date;
};

type FakeCongress = {
  id: string;
  name: string;
  code: string;
  startDate: Date | null;
  endDate: Date | null;
};

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: `user-${Math.random().toString(36).slice(2)}`,
    firstName: 'Ali',
    lastName: 'Yilmaz',
    phoneLast4: null,
    email: null,
    phone: null,
    passwordHash: null,
    mustChangePassword: false,
    lastLoginAt: null,
    role: 'PARTICIPANT',
    tokenVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// AuthService yalnizca Prisma'nin AuthService icinde gercekten kullandigi
// birkac cagriyi (user.findFirst/update, congressRegistration.findMany/findFirst)
// destekleyen kucuk, elle yazilmis bir sahte - ayni desen
// attendance-processing.service.spec.ts'de kullaniliyor.
function createFakePrisma(
  initialUsers: FakeUser[],
  registrations: FakeRegistration[],
  congresses: FakeCongress[],
) {
  const users = new Map(initialUsers.map((u) => [u.id, { ...u }]));
  const congressMap = new Map(congresses.map((c) => [c.id, c]));

  type UserWhere = {
    email?: string;
    phone?: string;
    registrations?: { some: { congressId?: string; isActive: boolean } };
  };

  function matchesWhere(user: FakeUser, where: UserWhere): boolean {
    if (where.email !== undefined && user.email !== where.email) return false;
    if (where.phone !== undefined && user.phone !== where.phone) return false;
    if (where.registrations) {
      const cond = where.registrations.some;
      const hasReg = registrations.some(
        (r) =>
          r.userId === user.id &&
          r.isActive === cond.isActive &&
          (cond.congressId === undefined || r.congressId === cond.congressId),
      );
      if (!hasReg) return false;
    }
    return true;
  }

  const prisma = {
    user: {
      findFirst: ({ where }: { where: UserWhere }) => {
        const match = [...users.values()].find((u) => matchesWhere(u, where));
        return Promise.resolve(match ?? null);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const user = users.get(where.id);
        if (!user) throw new Error('test setup hatasi: kullanici yok');
        const { tokenVersion, ...rest } = data;
        Object.assign(user, rest);
        if (tokenVersion) {
          user.tokenVersion += (
            tokenVersion as { increment: number }
          ).increment;
        }
        return Promise.resolve({ ...user });
      },
    },
    congressRegistration: {
      findMany: ({
        where,
      }: {
        where: { userId: string; isActive: boolean };
      }) => {
        const matched = registrations.filter(
          (r) => r.userId === where.userId && r.isActive === where.isActive,
        );
        return Promise.resolve(
          matched.map((r) => ({
            ...r,
            congress: congressMap.get(r.congressId),
          })),
        );
      },
      findFirst: ({
        where,
      }: {
        where: { userId: string; congressId: string; isActive: boolean };
      }) => {
        const match = registrations.find(
          (r) =>
            r.userId === where.userId &&
            r.congressId === where.congressId &&
            r.isActive === where.isActive,
        );
        return Promise.resolve(match ?? null);
      },
    },
  };

  return { prisma, users };
}

function createFakeJwtService() {
  return {
    signAsync: (payload: JwtPayload) =>
      Promise.resolve(JSON.stringify(payload)),
  };
}

function decodeToken(token: string): JwtPayload {
  return JSON.parse(token) as JwtPayload;
}

function createFakeMailSender() {
  const sent: { to: string; code: string }[] = [];
  return {
    sender: {
      sendVerificationCode: (to: string, code: string) => {
        sent.push({ to, code });
        return Promise.resolve();
      },
    },
    sent,
  };
}

function buildService(
  prisma: ReturnType<typeof createFakePrisma>['prisma'],
  mailSender: ReturnType<typeof createFakeMailSender>['sender'],
) {
  return new AuthService(
    prisma as never,
    createFakeJwtService() as never,
    mailSender,
  );
}

describe('AuthService', () => {
  describe('registerRequest / forgotPassword - kod uretimi', () => {
    it('aktif kaydi olan kullaniciya 6 haneli kod uretip e-postayla gonderir', async () => {
      const user = makeUser({
        email: 'ali@example.com',
        phone: '+905321111111',
      });
      const { prisma, users } = createFakePrisma(
        [user],
        [
          {
            id: 'reg-1',
            userId: user.id,
            congressId: 'cong-1',
            isActive: true,
            registeredAt: new Date(),
          },
        ],
        [],
      );
      const { sender, sent } = createFakeMailSender();
      const service = buildService(prisma, sender);

      const result = await service.registerRequest({
        emailOrPhone: 'ali@example.com',
      });

      expect(result.message).toBeDefined();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('ali@example.com');
      expect(sent[0].code).toMatch(/^\d{6}$/);

      const updated = users.get(user.id)!;
      expect(updated.mustChangePassword).toBe(true);
      expect(updated.passwordHash).toBeDefined();
      await expect(
        compare(sent[0].code, updated.passwordHash as string),
      ).resolves.toBe(true);
    });

    it('telefonla arasa da kod e-postaya gider', async () => {
      const user = makeUser({
        email: 'ayse@example.com',
        phone: '+905322222222',
      });
      const { prisma } = createFakePrisma(
        [user],
        [
          {
            id: 'reg-1',
            userId: user.id,
            congressId: 'cong-1',
            isActive: true,
            registeredAt: new Date(),
          },
        ],
        [],
      );
      const { sender, sent } = createFakeMailSender();
      const service = buildService(prisma, sender);

      await service.forgotPassword({ emailOrPhone: '05322222222' });

      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('ayse@example.com');
    });

    it('aktif kaydi olmayan/bulunamayan kullanici icin 404 doner', async () => {
      const { prisma } = createFakePrisma([], [], []);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      await expect(
        service.registerRequest({ emailOrPhone: 'yok@example.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('kullanicinin e-postasi yoksa 409 doner', async () => {
      const user = makeUser({ email: null, phone: '+905323333333' });
      const { prisma } = createFakePrisma(
        [user],
        [
          {
            id: 'reg-1',
            userId: user.id,
            congressId: 'cong-1',
            isActive: true,
            registeredAt: new Date(),
          },
        ],
        [],
      );
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      await expect(
        service.registerRequest({ emailOrPhone: '05323333333' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    async function seedLoggedInUser() {
      const passwordHash = await hash('Test1234!', 10);
      const user = makeUser({
        email: 'ali@example.com',
        passwordHash,
        mustChangePassword: false,
      });
      const congresses: FakeCongress[] = [
        {
          id: 'cong-1',
          name: 'Kongre 1',
          code: 'K1',
          startDate: null,
          endDate: null,
        },
      ];
      const registrations: FakeRegistration[] = [
        {
          id: 'reg-1',
          userId: user.id,
          congressId: 'cong-1',
          isActive: true,
          registeredAt: new Date(),
        },
      ];
      return { user, congresses, registrations };
    }

    it('dogru sifreyle giris yapar, token ve kongre listesini doner', async () => {
      const { user, congresses, registrations } = await seedLoggedInUser();
      const { prisma, users } = createFakePrisma(
        [user],
        registrations,
        congresses,
      );
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      const result = await service.login({
        emailOrPhone: 'ali@example.com',
        password: 'Test1234!',
      });

      expect(result.mustChangePassword).toBe(false);
      expect(result.user.id).toBe(user.id);
      expect(result.congresses).toHaveLength(1);
      expect(result.congresses[0].id).toBe('cong-1');

      const payload = decodeToken(result.accessToken);
      expect(payload.sub).toBe(user.id);
      // Login sonrasi HENUZ kongre secilmemis olmali.
      expect(payload.activeCongressId).toBeNull();

      expect(users.get(user.id)!.lastLoginAt).not.toBeNull();
    });

    it('yanlis sifreyle 401 doner', async () => {
      const { user, congresses, registrations } = await seedLoggedInUser();
      const { prisma } = createFakePrisma([user], registrations, congresses);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      await expect(
        service.login({
          emailOrPhone: 'ali@example.com',
          password: 'yanlis-sifre',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('kayitli olmayan kullanici icin de ayni genel hatayi doner (varlik sizdirmaz)', async () => {
      const { prisma } = createFakePrisma([], [], []);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      await expect(
        service.login({
          emailOrPhone: 'yok@example.com',
          password: 'herhangi',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('changePassword - mustChangePassword akisi', () => {
    it('gecici kodla giren kullanici sifresini degistirir, mustChangePassword kapanir', async () => {
      const tempCode = '482913';
      const passwordHash = await hash(tempCode, 10);
      const user = makeUser({
        email: 'ali@example.com',
        passwordHash,
        mustChangePassword: true,
        tokenVersion: 3,
      });
      const { prisma, users } = createFakePrisma([user], [], []);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      const authUser: AuthenticatedUser = {
        ...user,
        congressId: 'cong-1',
      } as never;

      const result = await service.changePassword(authUser, {
        currentPassword: tempCode,
        newPassword: 'YeniSifre123',
      });

      const payload = decodeToken(result.accessToken);
      // Aktif kongre secimi korunmali, tokenVersion 1 artmali.
      expect(payload.activeCongressId).toBe('cong-1');
      expect(payload.tokenVersion).toBe(4);

      const updated = users.get(user.id)!;
      expect(updated.mustChangePassword).toBe(false);
      await expect(
        compare('YeniSifre123', updated.passwordHash as string),
      ).resolves.toBe(true);
    });

    it('yanlis mevcut sifreyle 401 doner', async () => {
      const passwordHash = await hash('dogru-kod', 10);
      const user = makeUser({
        email: 'ali@example.com',
        passwordHash,
        mustChangePassword: true,
      });
      const { prisma } = createFakePrisma([user], [], []);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      const authUser: AuthenticatedUser = {
        ...user,
        congressId: null,
      } as never;

      await expect(
        service.changePassword(authUser, {
          currentPassword: 'yanlis-kod',
          newPassword: 'YeniSifre123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('selectCongress', () => {
    it('kayitli oldugu kongreyi secince yeni token doner, tokenVersion degismez', async () => {
      const user = makeUser({ email: 'ali@example.com', tokenVersion: 2 });
      const registrations: FakeRegistration[] = [
        {
          id: 'reg-1',
          userId: user.id,
          congressId: 'cong-2',
          isActive: true,
          registeredAt: new Date(),
        },
      ];
      const { prisma } = createFakePrisma([user], registrations, []);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      const authUser: AuthenticatedUser = {
        ...user,
        congressId: null,
      } as never;
      const result = await service.selectCongress(authUser, 'cong-2');

      const payload = decodeToken(result.accessToken);
      expect(payload.activeCongressId).toBe('cong-2');
      expect(payload.tokenVersion).toBe(2);
    });

    it('kayitli olmadigi kongreyi secmeye calisinca 403 doner', async () => {
      const user = makeUser({ email: 'ali@example.com' });
      const { prisma } = createFakePrisma([user], [], []);
      const { sender } = createFakeMailSender();
      const service = buildService(prisma, sender);

      const authUser: AuthenticatedUser = {
        ...user,
        congressId: null,
      } as never;

      await expect(
        service.selectCongress(authUser, 'baska-kongre'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
