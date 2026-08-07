import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
  detectImageType,
  EXTENSION_BY_IMAGE_TYPE,
} from './validate-image-file';
import { resolveUploadPath } from './resolve-upload-path';

export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

// Yeni bir bulut depolama servisi KURULMUYOR - dosya sistemi bu olcekte
// yeterli (bkz. docs/decisions.md). process.cwd() hem yerel gelistirmede
// (`backend/`den `npm run start:dev`) hem production container'inda
// (Dockerfile WORKDIR /app) dogru kok dizine cozumlenir.
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveFile(
    congressId: string,
    file: { buffer: Buffer; size: number },
  ): Promise<{ url: string }> {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('Dosya en fazla 2 MB olabilir');
    }

    // congressId DTO'da @IsUUID() ile zaten dogrulaniyor (slash/nokta
    // barindiramaz), ama klasor enjeksiyonuna karsi asil garanti kongrenin
    // GERCEKTEN var olmasidir.
    const congress = await this.prisma.congress.findUnique({
      where: { id: congressId },
      select: { id: true },
    });
    if (!congress) {
      throw new NotFoundException('Kongre bulunamadi');
    }

    // Uzantiya GUVENILMEZ - ilk baytlar (magic bytes) gercek turu belirler.
    const detectedType = detectImageType(file.buffer);
    if (!detectedType) {
      throw new BadRequestException(
        'Dosya desteklenen bir görsel formatı değil (yalnızca JPEG, PNG, WEBP kabul edilir)',
      );
    }

    // Dosya adi KULLANICIDAN ALINMAZ - her zaman sunucuda uretilen bir
    // UUID kullanilir, yol gecisi (../) imkansizdir.
    const filename = `${randomUUID()}${EXTENSION_BY_IMAGE_TYPE[detectedType]}`;
    const congressDir = join(UPLOADS_ROOT, congressId);
    await mkdir(congressDir, { recursive: true });
    await writeFile(join(congressDir, filename), file.buffer);

    return { url: `/uploads/${congressId}/${filename}` };
  }

  // Gecerli olmayan/uploads disina cikan bir url sessizce yok sayilir -
  // silme cagrisi hem kayit silme hem gorsel degistirme akislarindan "eski
  // deger neyse onu sil" bicimiyle cagriliyor; eski deger hic yuklenmemis
  // (null) olabilir, bu bir hata degildir.
  async deleteFile(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const filePath = resolveUploadPath(url, UPLOADS_ROOT);
    if (!filePath) return;
    await unlink(filePath).catch(() => {
      // dosya zaten yoksa (elle silinmis, cift tiklama vb.) sessizce gec
    });
  }
}
