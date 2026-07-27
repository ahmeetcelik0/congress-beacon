import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
import { HallService } from './hall.service';

// DTO seviyesindeki `capacity` dogrulamasi - NestJS'in global `ValidationPipe`'i
// (main.ts: whitelist+transform, enableImplicitConversion YOK) gercekte tam
// olarak bu ikiliyi (plainToInstance + validate) kullanir. congress.service.spec.ts
// ile ayni desen.
function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    congressId: '3537dc2a-6e96-4a03-bf6d-37447d11a1dd',
    name: 'Ana Salon',
    ...overrides,
  };
}

async function validateCreate(overrides: Record<string, unknown> = {}) {
  const dto = plainToInstance(CreateHallDto, validCreateBody(overrides));
  return validate(dto);
}

async function validateUpdate(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateHallDto, body);
  return validate(dto);
}

function capacityError(errors: Awaited<ReturnType<typeof validate>>) {
  return errors.find((error) => error.property === 'capacity');
}

describe('Salon kapasitesi dogrulamasi - CreateHallDto', () => {
  it('pozitif tam sayi icin basarili (hata yok)', async () => {
    const errors = await validateCreate({ capacity: 250 });
    expect(errors).toHaveLength(0);
  });

  it('capacity gonderilmeden (eski istemci uyumlulugu) basarili', async () => {
    const errors = await validateCreate();
    expect(errors).toHaveLength(0);
  });

  it('capacity: 0 dogrulama hatasi verir', async () => {
    const errors = await validateCreate({ capacity: 0 });
    expect(capacityError(errors)).toBeDefined();
  });

  it('negatif capacity dogrulama hatasi verir', async () => {
    const errors = await validateCreate({ capacity: -5 });
    expect(capacityError(errors)).toBeDefined();
  });

  it('ondalikli capacity dogrulama hatasi verir', async () => {
    const errors = await validateCreate({ capacity: 12.5 });
    expect(capacityError(errors)).toBeDefined();
  });

  it('string olarak gonderilen sayi (implicit conversion kapali oldugu icin) dogrulama hatasi verir', async () => {
    const errors = await validateCreate({ capacity: '250' });
    expect(capacityError(errors)).toBeDefined();
  });

  it('bos string capacity 0 olarak KAYDEDILMEZ - dogrulama hatasi verir', async () => {
    const errors = await validateCreate({ capacity: '' });
    expect(capacityError(errors)).toBeDefined();
  });
});

describe('Salon kapasitesi dogrulamasi - UpdateHallDto', () => {
  it('pozitif tam sayi ile guncelleme basarili', async () => {
    const errors = await validateUpdate({ capacity: 100 });
    expect(errors).toHaveLength(0);
  });

  it('capacity gonderilmeden guncelleme basarili (mevcut deger korunur)', async () => {
    const errors = await validateUpdate({ name: 'Yeni ad' });
    expect(errors).toHaveLength(0);
  });

  it('capacity: 0 dogrulama hatasi verir', async () => {
    const errors = await validateUpdate({ capacity: 0 });
    expect(capacityError(errors)).toBeDefined();
  });

  it('negatif capacity dogrulama hatasi verir', async () => {
    const errors = await validateUpdate({ capacity: -1 });
    expect(capacityError(errors)).toBeDefined();
  });

  it('ondalikli capacity dogrulama hatasi verir', async () => {
    const errors = await validateUpdate({ capacity: 10.1 });
    expect(capacityError(errors)).toBeDefined();
  });
});

// Servis seviyesi - hafif sahte PrismaService + CongressService ile (ayni
// desen: congress.service.spec.ts'teki `createFakePrismaForUpdate`).
function createFakeDeps(
  current: { capacity: number | null } = { capacity: null },
) {
  const fakePrisma = {
    hall: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'hall-1', ...data }),
        ),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'hall-1', name: 'Ana Salon', ...current }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'hall-1',
            name: 'Ana Salon',
            ...current,
            ...data,
          }),
        ),
      delete: jest.fn(),
    },
  };
  const fakeCongressService = {
    findOne: jest.fn().mockResolvedValue({ id: 'congress-1' }),
  };
  return { fakePrisma, fakeCongressService };
}

describe('HallService.create() - capacity Prisma aktarimi', () => {
  it('capacity gonderildiginde Prisma create verisine aktarilir', async () => {
    const { fakePrisma, fakeCongressService } = createFakeDeps();
    const service = new HallService(
      fakePrisma as never,
      fakeCongressService as never,
    );

    const result = await service.create({
      congressId: 'congress-1',
      name: 'Ana Salon',
      capacity: 300,
    });

    expect(fakePrisma.hall.create).toHaveBeenCalledTimes(1);
    expect(result.capacity).toBe(300);
  });

  it('capacity gonderilmediginde null olarak Prisma create verisine aktarilir (varsayilan deger ATANMAZ)', async () => {
    const { fakePrisma, fakeCongressService } = createFakeDeps();
    const service = new HallService(
      fakePrisma as never,
      fakeCongressService as never,
    );

    const result = await service.create({
      congressId: 'congress-1',
      name: 'Ana Salon',
    });

    expect(result.capacity).toBeNull();
  });
});

describe('HallService.update() - kismi PATCH capacity', () => {
  it('null kapasiteli salon pozitif bir degerle guncellenebilir', async () => {
    const { fakePrisma, fakeCongressService } = createFakeDeps({
      capacity: null,
    });
    const service = new HallService(
      fakePrisma as never,
      fakeCongressService as never,
    );

    const result = await service.update('hall-1', { capacity: 150 });

    expect(result.capacity).toBe(150);
  });

  it('mevcut capacity yeni pozitif degerle degisir', async () => {
    const { fakePrisma, fakeCongressService } = createFakeDeps({
      capacity: 100,
    });
    const service = new HallService(
      fakePrisma as never,
      fakeCongressService as never,
    );

    const result = await service.update('hall-1', { capacity: 200 });

    expect(result.capacity).toBe(200);
  });

  it('capacity gonderilmezse mevcut deger korunur', async () => {
    const { fakePrisma, fakeCongressService } = createFakeDeps({
      capacity: 100,
    });
    const service = new HallService(
      fakePrisma as never,
      fakeCongressService as never,
    );

    const result = await service.update('hall-1', { name: 'Guncellenmis Ad' });

    expect(result.capacity).toBe(100);
  });
});
