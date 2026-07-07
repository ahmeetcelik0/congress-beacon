import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CongressService } from '../congress/congress.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';

@Injectable()
export class HallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly congressService: CongressService,
  ) {}

  async create(dto: CreateHallDto) {
    await this.congressService.findOne(dto.congressId);
    return this.prisma.hall.create({
      data: {
        congressId: dto.congressId,
        name: dto.name,
        rssiThreshold: dto.rssiThreshold ?? -70,
      },
    });
  }

  findAll(congressId?: string) {
    return this.prisma.hall.findMany({
      where: congressId ? { congressId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const hall = await this.prisma.hall.findUnique({ where: { id } });
    if (!hall) {
      throw new NotFoundException(`Hall ${id} bulunamadi`);
    }
    return hall;
  }

  async update(id: string, dto: UpdateHallDto) {
    await this.findOne(id);
    return this.prisma.hall.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.hall.delete({ where: { id } });
  }
}
