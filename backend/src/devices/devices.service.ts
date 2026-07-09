import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  register(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.device.create({
      data: {
        userId,
        platform: dto.platform,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion,
        appVersion: dto.appVersion,
        pushToken: dto.pushToken,
      },
    });
  }

  async updatePushToken(userId: string, dto: UpdatePushTokenDto) {
    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
    });
    if (!device || device.userId !== userId) {
      throw new ForbiddenException('Bu cihaz bu kullaniciya ait degil');
    }

    return this.prisma.device.update({
      where: { id: dto.deviceId },
      data: { pushToken: dto.pushToken },
    });
  }
}
