import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCongressDto } from './dto/create-congress.dto';
import { UpdateCongressDto } from './dto/update-congress.dto';

@Injectable()
export class CongressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  create(dto: CreateCongressDto) {
    return this.prisma.congress.create({
      data: {
        name: dto.name,
        code: dto.code,
        accessCode: dto.accessCode,
        beaconUuid: dto.beaconUuid,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        observationIntervalSeconds: dto.observationIntervalSeconds,
        emaAlpha: dto.emaAlpha,
        hampelK: dto.hampelK,
        hampelWindowSize: dto.hampelWindowSize,
        confidenceTemperature: dto.confidenceTemperature,
        entryProbabilityThreshold: dto.entryProbabilityThreshold,
        exitProbabilityThreshold: dto.exitProbabilityThreshold,
        ambiguityMarginPct: dto.ambiguityMarginPct,
        staleGraceSeconds: dto.staleGraceSeconds,
      },
    });
  }

  findAll() {
    return this.prisma.congress.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const congress = await this.prisma.congress.findUnique({ where: { id } });
    if (!congress) {
      throw new NotFoundException(`Congress ${id} bulunamadi`);
    }
    return congress;
  }

  async update(id: string, dto: UpdateCongressDto) {
    const current = await this.findOne(id);
    // `migrateExistingBeacons` bir Congress alani DEGIL - Prisma'nin
    // `data` nesnesine bilinmeyen alan olarak sizmasin diye ayristirilir
    // (bkz. asagidaki beaconUuid mantigi, Faz 6.2 talimati §1).
    const { migrateExistingBeacons, ...updateFields } = dto;

    // DTO seviyesindeki kural yalnizca iki alan da ayni istekte gonderilirse
    // calisabilir. Kismi bir PATCH kurali atlamasin diye, kayitli degerlerle
    // birlestirilmis son hal burada bir kez daha dogrulanir.
    const entryThreshold =
      dto.entryProbabilityThreshold ?? current.entryProbabilityThreshold;
    const exitThreshold =
      dto.exitProbabilityThreshold ?? current.exitProbabilityThreshold;
    if (entryThreshold <= exitThreshold) {
      throw new BadRequestException(
        'Giris esigi cikis esiginden buyuk olmalidir',
      );
    }

    // Ayni birlesik-kontrol deseni tarihler icin: DTO seviyesindeki
    // `IsDateOnOrAfterField` yalnizca iki alan da AYNI istekte gelirse
    // calisabiliyor. Yalnizca `endDate` (veya yalnizca `startDate`)
    // gonderilen kismi bir PATCH, kayittaki diger tarihle celisebilir - bu
    // yuzden nihai (kayitli + gelen) cift burada bir kez daha dogrulanir.
    const finalStartDate = dto.startDate
      ? new Date(dto.startDate)
      : current.startDate;
    const finalEndDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
    if (
      finalStartDate &&
      finalEndDate &&
      finalEndDate.getTime() < finalStartDate.getTime()
    ) {
      throw new BadRequestException(
        'Bitis tarihi baslangic tarihinden once olamaz.',
      );
    }

    // Kapak gorseli DEGISIYORSA (yeni bir url'e ya da bos'a) ve ESKI deger
    // doluysa, eski dosya diskten silinir.
    if (
      dto.coverImageUrl !== undefined &&
      current.coverImageUrl &&
      current.coverImageUrl !== dto.coverImageUrl
    ) {
      await this.uploads.deleteFile(current.coverImageUrl);
    }

    // beaconUuid GERCEKTEN degisiyorsa (normalize edilmis karsilastirma -
    // bkz. beacon.service.ts normalizeUuid) ve kongrede zaten beacon
    // kayitliysa, sessizce yarisi eski/yarisi yeni UUID'de kalmasin diye
    // acik onay istenir (bkz. Faz 6.2 talimati §1).
    const normalizedNewUuid = dto.beaconUuid?.toUpperCase();
    const beaconUuidChanging =
      normalizedNewUuid !== undefined &&
      normalizedNewUuid !== current.beaconUuid.toUpperCase();

    let affectedBeaconCount = 0;
    if (beaconUuidChanging) {
      affectedBeaconCount = await this.prisma.beacon.count({
        where: { congressId: id },
      });
      if (affectedBeaconCount > 0 && !migrateExistingBeacons) {
        throw new ConflictException(
          `Bu kongrede ${affectedBeaconCount} beacon kayitli olusu icin ` +
            `beaconUuid degistirilemiyor. Devam etmek icin ` +
            `migrateExistingBeacons: true gonderin - bu, kongrenin ` +
            `TUM beacon'larinin uuid'sini de yeni degerle birlikte gunceller.`,
        );
      }
    }

    const updateData = {
      ...updateFields,
      beaconUuid: normalizedNewUuid,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    };

    // Beacon migrasyonu gerekiyorsa Congress + tum Beacon satirlari TEK
    // transaction'da guncellenir - biri basarisiz olursa digeri de geri
    // alinir, tutarsiz bir ara durum (bazi beacon'lar eski, bazilari yeni
    // UUID'de) asla olusmaz.
    if (beaconUuidChanging && affectedBeaconCount > 0) {
      return this.prisma.$transaction(async (tx) => {
        await tx.beacon.updateMany({
          where: { congressId: id },
          data: { uuid: normalizedNewUuid },
        });
        const updated = await tx.congress.update({
          where: { id },
          data: updateData,
        });
        return { ...updated, beaconsUpdated: affectedBeaconCount };
      });
    }

    return this.prisma.congress.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.congress.delete({ where: { id } });
    } catch (error) {
      // Congress'e dogrudan bagli Hall/Beacon/User/Session kayitlari varsa
      // MySQL FK kisitlamasi (ON DELETE RESTRICT) siliniyi reddeder - Prisma
      // bunu P2003 olarak raporlar (canli dogrulandi, bkz. teslim raporu).
      // Beklenmeyen/diger Prisma hatalari (veya Prisma disi hatalar) mevcut
      // genel 500 akisina gitmeye devam eder - yalnizca bu spesifik, bilinen
      // ve kullaniciya guvenle aciklanabilecek durum 409'a cevrilir; ham
      // Prisma/SQL mesaji hicbir zaman disari sizmaz.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Bu kongreye bagli salon, beacon, katilimci veya oturum kayitlari bulundugu icin kongre silinemiyor. Once bagli kayitlari kaldirin.',
        );
      }
      throw error;
    }
  }
}
