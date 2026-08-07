import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';

// JwtAuthGuard'dan SONRA calisir (request.user'in dolu olmasina guvenir).
// Kongre secmeden ve zorunlu sifre degisikligini tamamlamadan once
// katilimcinin kongre-ozel uc noktalara (observation, cihaz, bildirim)
// erismesini engeller. /auth/* uc noktalari bu guard'i KULLANMAZ - kullanici
// kongre secmeden/sifre degistirmeden once de giris yapip kongrelerini
// listeleyebilmeli; bu sayede ayri bir "haric tutma" mekanizmasina gerek
// kalmiyor (bkz. docs/decisions.md).
@Injectable()
export class ActiveCongressGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.congressId) {
      throw new ForbiddenException('Once bir kongre secmelisiniz');
    }
    if (user.mustChangePassword) {
      throw new ForbiddenException('Once sifrenizi degistirmelisiniz');
    }

    return true;
  }
}
