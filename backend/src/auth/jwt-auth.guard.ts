import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.service';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Yetkilendirme basligi eksik');
    }

    const token = authHeader.slice('Bearer '.length);

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Gecersiz veya suresi dolmus token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token artik gecerli degil');
    }

    // User modelinde artik congressId kolonu yok (Faz 1) - aktif kongre
    // token'in kendisinde tasinir. Buraya enjekte edilmesinin tek amaci,
    // user.congressId okuyan mevcut kodun (attendance/observation/devices)
    // degismeden calismasidir.
    request.user = { ...user, congressId: payload.activeCongressId };
    return true;
  }
}
