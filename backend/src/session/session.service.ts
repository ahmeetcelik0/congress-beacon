import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { NotificationSchedulerService } from '../notifications/notification-scheduler.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationScheduler: NotificationSchedulerService,
  ) {}

  async create(dto: CreateSessionDto) {
    const session = await this.prisma.session.create({
      data: {
        congressId: dto.congressId,
        hallId: dto.hallId,
        title: dto.title,
        speaker: dto.speaker,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        description: dto.description,
      },
    });

    await this.notificationScheduler.scheduleForSession(session);
    return session;
  }

  findAll(congressId: string) {
    return this.prisma.session.findMany({
      where: { congressId },
      include: { hall: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Session ${id} bulunamadi`);
    }
    return session;
  }

  async update(id: string, dto: UpdateSessionDto) {
    await this.findOne(id);
    const session = await this.prisma.session.update({
      where: { id },
      data: {
        ...dto,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      },
    });

    await this.notificationScheduler.scheduleForSession(session);
    return session;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.notificationScheduler.cancelForSession(id);
    await this.prisma.session.delete({ where: { id } });
  }
}
