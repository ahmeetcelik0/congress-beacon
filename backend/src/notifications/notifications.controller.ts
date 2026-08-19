import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveCongressGuard } from '../auth/active-congress.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-request';
import { MarkNotificationOpenedDto } from './dto/mark-notification-opened.dto';

// Mobil, bildirime dokununca bunu cagirir (henuz mobil tarafta baglanmadi,
// ama backend hazir - bkz. docs/mobile-next-tasks.md).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('opened')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  async markOpened(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkNotificationOpenedDto,
  ) {
    const log = await this.prisma.notificationLog.findUnique({
      where: { id: dto.notificationLogId },
    });
    if (!log || log.userId !== user.id) {
      throw new ForbiddenException('Bu bildirim bu kullaniciya ait degil');
    }

    return this.prisma.notificationLog.update({
      where: { id: dto.notificationLogId },
      data: { openedAt: new Date() },
    });
  }
}
