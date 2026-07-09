import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';

export type AdminJwtPayload = {
  sub: string;
  type: 'admin';
};

export type AdminLoginResult = {
  accessToken: string;
  admin: {
    id: string;
    email: string;
    name: string;
  };
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto): Promise<AdminLoginResult> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('E-posta veya sifre hatali');
    }

    const passwordMatches = await compare(dto.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('E-posta veya sifre hatali');
    }

    const payload: AdminJwtPayload = { sub: admin.id, type: 'admin' };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }
}
