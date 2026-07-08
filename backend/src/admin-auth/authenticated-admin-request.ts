import type { Request } from 'express';
import type { AdminUser } from '../../generated/prisma/client';

export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminUser;
}
