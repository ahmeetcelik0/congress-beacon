import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminJwtPayload } from './admin-auth.service';
import type { AuthenticatedAdminRequest } from './authenticated-admin-request';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedAdminRequest>();
    const authHeader = request.headers['authorization'];
    // <a href> ile tetiklenen dosya indirme linkleri (orn. CSV export) custom
    // header gonderemez; bu tek durum icin query string'den token okumaya da
    // izin veriyoruz (dahili/pilot panel oldugu icin kabul edilebilir bir odun).
    const queryToken = request.query?.token;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : typeof queryToken === 'string'
        ? queryToken
        : null;

    if (!token) {
      throw new UnauthorizedException('Yetkilendirme basligi eksik');
    }

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Gecersiz veya suresi dolmus token');
    }

    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Bu token admin icin gecerli degil');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin kullanici bulunamadi');
    }

    request.admin = admin;
    return true;
  }
}
