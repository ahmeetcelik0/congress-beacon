import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveCongressGuard } from '../auth/active-congress.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-request';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard, ActiveCongressGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devicesService.register(user.id, dto);
  }

  @Put('push-token')
  updatePushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePushTokenDto,
  ) {
    return this.devicesService.updatePushToken(user.id, dto);
  }
}
