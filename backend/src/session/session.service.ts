import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { NotificationSchedulerService } from '../notifications/notification-scheduler.service';

// Program roluyle eslesen kullanicinin panelde gosterilecek asgari alanlari -
// tam User satirini (passwordHash dahil) sizdirmamak icin daima bu select
// kullanilir.
const ROLE_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  phoneRaw: true,
} as const;

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
        sessionType: dto.sessionType,
        dayLabel: dto.dayLabel,
        keywords: dto.keywords,
        displayOrder: dto.displayOrder,
      },
    });

    await this.notificationScheduler.scheduleForSession(session);
    return session;
  }

  // Sunumlari ve rolleri IC ICE doner - panelin ayrica istek atmasina
  // gerek kalmaz (bkz. gorev tanimi). Siralama: gun etiketi -> gercek
  // baslangic saati -> elle belirlenen displayOrder (aym gun+saatteki
  // esitlik bozucu).
  findAll(congressId: string) {
    return this.prisma.session.findMany({
      where: { congressId },
      include: {
        hall: true,
        presentations: {
          orderBy: { displayOrder: 'asc' },
          include: {
            roles: {
              orderBy: { displayOrder: 'asc' },
              include: { user: { select: ROLE_USER_SELECT } },
            },
          },
        },
        roles: {
          orderBy: { displayOrder: 'asc' },
          include: { user: { select: ROLE_USER_SELECT } },
        },
      },
      orderBy: [
        { dayLabel: 'asc' },
        { startTime: 'asc' },
        { displayOrder: 'asc' },
      ],
    });
  }

  async reorder(ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.session.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
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
