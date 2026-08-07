import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

function createFakePrisma(existingCongressIds: string[]) {
  return {
    congress: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          existingCongressIds.includes(where.id) ? { id: where.id } : null,
        ),
    },
  };
}

function buildService(existingCongressIds: string[] = ['congress-1']) {
  return new UploadsService(createFakePrisma(existingCongressIds) as never);
}

// Gercek bir JPEG imzasi (icerik onemsiz, sadece dogrulamadan gecmesi icin).
function validJpegBuffer(size = 100): Buffer {
  const buffer = Buffer.alloc(size);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

describe('UploadsService.saveFile - dogrulama', () => {
  it('2 MB üzerindeki dosyayi disk I/O YAPMADAN reddeder', async () => {
    const service = buildService();
    const oversized = { buffer: validJpegBuffer(10), size: 3 * 1024 * 1024 };

    await expect(
      service.saveFile('congress-1', oversized),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('var olmayan kongre icin 404 doner', async () => {
    const service = buildService([]);
    const file = { buffer: validJpegBuffer(), size: 100 };

    await expect(service.saveFile('yok-kongre', file)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('.png uzantili gibi davransa da gercekte gorsel olmayan icerigi reddeder', async () => {
    const service = buildService();
    const fakeImage = {
      buffer: Buffer.from('bu bir metin dosyasi, gorsel degil'),
      size: 100,
    };

    await expect(
      service.saveFile('congress-1', fakeImage),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PDF icerigini reddeder', async () => {
    const service = buildService();
    const fakePdf = {
      buffer: Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(50)]),
      size: 100,
    };

    await expect(
      service.saveFile('congress-1', fakePdf),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UploadsService.deleteFile', () => {
  it('bos/null url icin sessizce doner (hata firlatmaz)', async () => {
    const service = buildService();
    await expect(service.deleteFile(null)).resolves.toBeUndefined();
    await expect(service.deleteFile(undefined)).resolves.toBeUndefined();
  });

  it('/uploads/ ile baslamayan bir url icin dosya sistemine DOKUNMADAN doner', async () => {
    const service = buildService();
    // Path traversal veya alakasiz bir deger - hata firlatmamali, sessizce yok saymali.
    await expect(service.deleteFile('/etc/passwd')).resolves.toBeUndefined();
    await expect(
      service.deleteFile('/uploads/../../etc/passwd'),
    ).resolves.toBeUndefined();
  });
});
