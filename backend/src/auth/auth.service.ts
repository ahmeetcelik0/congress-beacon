import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PilotLoginDto } from './dto/pilot-login.dto';

export type JwtPayload = {
  sub: string;
  congressId: string;
  role: string;
  tokenVersion: number;
};

export type PilotLoginResult = {
  accessToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  congress: {
    id: string;
    name: string;
    code: string;
    beaconUuid: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async pilotLogin(dto: PilotLoginDto): Promise<PilotLoginResult> {
    const congress = await this.prisma.congress.findUnique({
      where: { code: dto.congressCode },
    });

    if (!congress) {
      throw new NotFoundException('Kongre bulunamadi');
    }

    if (congress.accessCode !== dto.congressAccessCode) {
      throw new UnauthorizedException('Erisim kodu gecersiz');
    }

    let user = await this.prisma.user.findUnique({
      where: {
        congressId_firstName_lastName_phoneLast4: {
          congressId: congress.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phoneLast4: dto.phoneLast4,
        },
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          congressId: congress.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phoneLast4: dto.phoneLast4,
        },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      congressId: user.congressId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      congress: {
        id: congress.id,
        name: congress.name,
        code: congress.code,
        beaconUuid: congress.beaconUuid,
      },
    };
  }
}
