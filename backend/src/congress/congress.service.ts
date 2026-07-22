import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCongressDto } from './dto/create-congress.dto';
import { UpdateCongressDto } from './dto/update-congress.dto';

@Injectable()
export class CongressService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.congress.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.congress.delete({ where: { id } });
  }
}
