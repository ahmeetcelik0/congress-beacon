import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AuditLogInterceptor } from './audit-log.interceptor';

@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtGuard, AuditLogInterceptor],
  exports: [AdminJwtGuard, AuditLogInterceptor],
})
export class AdminAuthModule {}
