import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminUser } from '../../generated/prisma/client';
import type { AuthenticatedAdminRequest } from './authenticated-admin-request';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedAdminRequest>();
    return request.admin as AdminUser;
  },
);
