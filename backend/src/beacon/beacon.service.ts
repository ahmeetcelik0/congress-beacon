import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CongressService } from '../congress/congress.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateBeaconDto } from './dto/create-beacon.dto';
import { UpdateBeaconDto } from './dto/update-beacon.dto';

// Beacon UUID'lerinin depolama/karsilastirma bicimi TEK NOKTADAN sabitlenir
// (buyuk harf) - MySQL sutun collation'i (utf8mb4_unicode_ci) SQL
// sorgularinda zaten buyuk/kucuk harf duyarsiz calisiyor, ama uygulama
// katmanindaki (JS) dogrudan string karsilastirmalari (ör. bu dosyadaki
// dto.uuid !== congress.beaconUuid) buna guvenemez - bu yuzden yazma
// aninda acikca normalize edilir (bkz. docs/decisions.md "Faz 6.2").
function normalizeUuid(uuid: string): string {
  return uuid.toUpperCase();
}

@Injectable()
export class BeaconService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly congressService: CongressService,
  ) {}

  async create(dto: CreateBeaconDto) {
    const congress = await this.congressService.findOne(dto.congressId);
    const normalizedUuid = normalizeUuid(dto.uuid);

    // Kongrenin beaconUuid'i bos ise (ör. seed veya elle olusturulmus eski
    // kayit) bu, o kongreye eklenen ILK beacon demektir - kongrenin UUID'sini
    // buradan benimsemek, operatorun ayni degeri iki yerde elle girmesini
    // gereksiz kilar (bkz. Faz 6.2 talimati §1). Congress + Beacon yazimi
    // TEK transaction'da: biri basarisiz olursa digeri de geri alinir.
    const congressBeaconUuidAutoSet = !congress.beaconUuid;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (congressBeaconUuidAutoSet) {
          await tx.congress.update({
            where: { id: congress.id },
            data: { beaconUuid: normalizedUuid },
          });
        } else if (normalizeUuid(congress.beaconUuid) !== normalizedUuid) {
          throw new BadRequestException(
            `Beacon UUID'si kongrenin UUID'siyle eslesmiyor ` +
              `(kongre: ${congress.beaconUuid}, girilen: ${dto.uuid})`,
          );
        }

        const beacon = await tx.beacon.create({
          data: {
            congressId: dto.congressId,
            uuid: normalizedUuid,
            major: dto.major,
            minor: dto.minor,
            label: dto.label,
          },
        });

        return { ...beacon, congressBeaconUuidAutoSet };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu kongrede ayni uuid/major/minor kombinasyonuna sahip bir beacon zaten var',
        );
      }
      throw error;
    }
  }

  findAll(congressId?: string) {
    return this.prisma.beacon.findMany({
      where: congressId ? { congressId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const beacon = await this.prisma.beacon.findUnique({ where: { id } });
    if (!beacon) {
      throw new NotFoundException(`Beacon ${id} bulunamadi`);
    }
    return beacon;
  }

  async update(id: string, dto: UpdateBeaconDto) {
    const beacon = await this.findOne(id);

    // `uuid` PATCH'te opsiyonel (UpdateBeaconDto) - yalnizca GERCEKTEN
    // gonderildiyse kongreyle tutarlilik kontrol edilir. Kongrenin
    // beaconUuid'i (normalde create() tarafindan zaten doldurulmus olmasi
    // gereken) hala bosa dokunmuyoruz (bkz. Faz 6.2 talimati - "ilk beacon"
    // benimsemesi yalnizca create() baglaminda).
    let normalizedUuid: string | undefined;
    if (dto.uuid !== undefined) {
      const congress = await this.congressService.findOne(beacon.congressId);
      normalizedUuid = normalizeUuid(dto.uuid);
      if (
        congress.beaconUuid &&
        normalizeUuid(congress.beaconUuid) !== normalizedUuid
      ) {
        throw new BadRequestException(
          `Beacon UUID'si kongrenin UUID'siyle eslesmiyor ` +
            `(kongre: ${congress.beaconUuid}, girilen: ${dto.uuid})`,
        );
      }
    }

    try {
      return await this.prisma.beacon.update({
        where: { id },
        data: { ...dto, uuid: normalizedUuid },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu kongrede ayni uuid/major/minor kombinasyonuna sahip bir beacon zaten var',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.beacon.delete({ where: { id } });
  }
}
