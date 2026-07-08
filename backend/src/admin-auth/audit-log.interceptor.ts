import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedAdminRequest } from './authenticated-admin-request';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// AdminJwtGuard'in korudugu mutating (POST/PATCH/PUT/DELETE) route'larda hangi
// admin'in ne yaptigini otomatik kaydeder; controller'lara ayrica kod eklemeye gerek kalmaz.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedAdminRequest>();

    if (!MUTATING_METHODS.has(request.method) || !request.admin) {
      return next.handle();
    }

    const controllerName = context.getClass().name.replace('Controller', '');
    const handlerName = context.getHandler().name;
    const adminId = request.admin.id;

    return next.handle().pipe(
      tap((result) => {
        const paramId = request.params?.id;
        const entityId =
          result && typeof result === 'object' && 'id' in result
            ? String((result as { id: unknown }).id)
            : paramId
              ? String(paramId)
              : null;

        this.prisma.auditLog
          .create({
            data: {
              adminUserId: adminId,
              action: `${request.method} ${handlerName}`,
              entityType: controllerName,
              entityId,
              metadata: { params: request.params, query: request.query },
            },
          })
          .catch(() => {
            // audit log yazimi basarisiz olsa da asil istegi etkilemesin
          });
      }),
    );
  }
}
