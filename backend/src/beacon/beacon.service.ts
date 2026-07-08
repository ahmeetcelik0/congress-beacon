import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CongressService } from '../congress/congress.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateBeaconDto } from './dto/create-beacon.dto';
import { UpdateBeaconDto } from './dto/update-beacon.dto';

@Injectable()
export class BeaconService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly congressService: CongressService,
  ) {}

  async create(dto: CreateBeaconDto) {
    await this.congressService.findOne(dto.congressId);
    try {
      return await this.prisma.beacon.create({
        data: {
          congressId: dto.congressId,
          uuid: dto.uuid,
          major: dto.major,
          minor: dto.minor,
          label: dto.label,
        },
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
    await this.findOne(id);
    try {
      return await this.prisma.beacon.update({
        where: { id },
        data: dto,
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
