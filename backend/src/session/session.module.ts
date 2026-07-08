import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AdminAuthModule, NotificationsModule],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
