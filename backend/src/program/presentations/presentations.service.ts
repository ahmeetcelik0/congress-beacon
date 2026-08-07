import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { UpdatePresentationDto } from './dto/update-presentation.dto';

/**
 * Presentation'in `congressId` alani YOK (Session uzerinden dolayli) - bu
 * yuzden Faz 3'un congress-scoped `ContentCrudService<T>`sine zorla
 * oturtulmuyor (o taban sinif `congressId`yi dogrudan zorunlu kilar).
 * Davranis (kongre yerine oturum varligi dogrulamasi + reorder) buraya
 * ayrica, kucuk ve okunabilir sekilde yazildi.
 */
@Injectable()
export class PresentationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sessionId: string) {
    return this.prisma.presentation.findMany({
      where: { sessionId },
      include: {
        roles: {
          orderBy: { displayOrder: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                phoneRaw: true,
              },
            },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  private async assertSessionExists(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException('Oturum bulunamadi');
    }
  }

  private async findOrThrow(id: string) {
    const presentation = await this.prisma.presentation.findUnique({
      where: { id },
    });
    if (!presentation) {
      throw new NotFoundException('Sunum bulunamadi');
    }
    return presentation;
  }

  async create(dto: CreatePresentationDto) {
    await this.assertSessionExists(dto.sessionId);
    return this.prisma.presentation.create({
      data: {
        sessionId: dto.sessionId,
        title: dto.title,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        abstract: dto.abstract,
      },
    });
  }

  async update(id: string, dto: UpdatePresentationDto) {
    await this.findOrThrow(id);
    return this.prisma.presentation.update({
      where: { id },
      data: {
        title: dto.title,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        abstract: dto.abstract,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    // ProgramRole.presentationId onDelete: Cascade - baglibulunan roller de
    // silinir (bkz. schema.prisma, canli test edildi).
    await this.prisma.presentation.delete({ where: { id } });
  }

  async reorder(ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.presentation.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
  }
}
