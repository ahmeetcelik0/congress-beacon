import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PilotLoginDto } from './dto/pilot-login.dto';
import { EmailOrPhoneDto } from './dto/email-or-phone.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { parseEmailOrPhone } from './parse-email-or-phone';
import type { AuthenticatedUser } from './authenticated-request';
import { MAIL_SENDER } from '../mail/mail-sender.interface';
import type { MailSender } from '../mail/mail-sender.interface';
import { RegistrationSource } from '../../generated/prisma/client';

const PASSWORD_HASH_ROUNDS = 10;

export type JwtPayload = {
  sub: string;
  activeCongressId: string | null;
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

type CongressSummary = {
  id: string;
  name: string;
  code: string;
  startDate: Date | null;
  endDate: Date | null;
};

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export type LoginResult = {
  accessToken: string;
  mustChangePassword: boolean;
  user: UserSummary;
  congresses: CongressSummary[];
};

export type MeResult = {
  user: UserSummary;
  activeCongressId: string | null;
  mustChangePassword: boolean;
  congresses: CongressSummary[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
  ) {}

  async registerRequest(dto: EmailOrPhoneDto): Promise<{ message: string }> {
    await this.issueVerificationCode(dto.emailOrPhone);
    return { message: 'Dogrulama kodu e-posta adresinize gonderildi' };
  }

  async forgotPassword(dto: EmailOrPhoneDto): Promise<{ message: string }> {
    await this.issueVerificationCode(dto.emailOrPhone);
    return { message: 'Dogrulama kodu e-posta adresinize gonderildi' };
  }

  // register-request ve forgot-password AYNI akisi paylasir: kongreye
  // aktif kaydi olan bir kullanici bulunmali, 6 haneli kod uretilip
  // gecici sifre olarak hashlenir ve mustChangePassword=true isaretlenir.
  // Kod her zaman E-POSTAYA gider (telefonla kayit olunmus olsa bile - SMS
  // bu fazin kapsaminda degil).
  private async issueVerificationCode(emailOrPhone: string): Promise<void> {
    const parsed = parseEmailOrPhone(emailOrPhone);

    // 'unrecognized' icin DB'de hicbir 'phone'/'email' degeriyle arama
    // yapilmaz - dogrudan "bulunamadi" davranisina dusulur.
    const user =
      parsed.type === 'unrecognized'
        ? null
        : await this.prisma.user.findFirst({
            where: {
              ...(parsed.type === 'email'
                ? { email: parsed.value }
                : { phone: parsed.value }),
              registrations: { some: { isActive: true } },
            },
          });
    if (!user) {
      throw new NotFoundException(
        'Bu bilgiyle kayitli aktif kongre bulunamadi',
      );
    }
    if (!user.email) {
      throw new ConflictException(
        'Bu kayitta e-posta adresi yok, kongre kayit birimiyle iletisime gecin',
      );
    }

    // 6 haneli kod - Math.random DEGIL, kriptografik olarak guvenli.
    const code = randomInt(100_000, 1_000_000).toString();
    const passwordHash = await hash(code, PASSWORD_HASH_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.mailSender.sendVerificationCode(user.email, code);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const parsed = parseEmailOrPhone(dto.emailOrPhone);

    const user =
      parsed.type === 'unrecognized'
        ? null
        : await this.prisma.user.findFirst({
            where:
              parsed.type === 'email'
                ? { email: parsed.value }
                : { phone: parsed.value },
          });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('E-posta/telefon veya sifre hatali');
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('E-posta/telefon veya sifre hatali');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const congresses = await this.getCongressesForUser(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      activeCongressId: null,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
      congresses,
    };
  }

  async getMe(user: AuthenticatedUser): Promise<MeResult> {
    const congresses = await this.getCongressesForUser(user.id);
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
      activeCongressId: user.congressId,
      mustChangePassword: user.mustChangePassword,
      congresses,
    };
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<{ accessToken: string }> {
    if (!user.passwordHash) {
      throw new UnauthorizedException('Bu hesap icin sifre tanimli degil');
    }

    const passwordMatches = await compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Mevcut sifre hatali');
    }

    const newPasswordHash = await hash(dto.newPassword, PASSWORD_HASH_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        // Diger tum oturumlari dusurur; bu istekten donen YENI token
        // (asagida) ayni oturumun aninda kilitlenmesini engeller.
        tokenVersion: { increment: 1 },
      },
    });

    const payload: JwtPayload = {
      sub: updated.id,
      // Aktif kongre secimi korunur - sifre degisikligi kongre secimini
      // sifirlamamali, aksi halde mobil kullaniciyi tekrar kongre secmeye
      // zorlardik.
      activeCongressId: user.congressId,
      role: updated.role,
      tokenVersion: updated.tokenVersion,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  async getCongressesForUser(userId: string): Promise<CongressSummary[]> {
    const registrations = await this.prisma.congressRegistration.findMany({
      where: { userId, isActive: true },
      include: { congress: true },
      orderBy: { registeredAt: 'desc' },
    });

    return registrations.map((registration) => ({
      id: registration.congress.id,
      name: registration.congress.name,
      code: registration.congress.code,
      startDate: registration.congress.startDate,
      endDate: registration.congress.endDate,
    }));
  }

  async selectCongress(
    user: AuthenticatedUser,
    congressId: string,
  ): Promise<{ accessToken: string }> {
    const registration = await this.prisma.congressRegistration.findFirst({
      where: { userId: user.id, congressId, isActive: true },
    });
    if (!registration) {
      throw new ForbiddenException('Bu kongrede kayitli degilsiniz');
    }

    const payload: JwtPayload = {
      sub: user.id,
      activeCongressId: congressId,
      role: user.role,
      // tokenVersion artirilmiyor - eski token gecerli kalir, yalnizca
      // aktif kongre secimi yeni bir token'a tasiniyor.
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

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

    // Faz 1: User artik tek bir kongreye kilitli degil - eslesme artik
    // (ad+soyad+telefon son 4 hane) VE "bu kongrede aktif kaydi var mi"
    // sartinin birlikte saglanmasiyla CongressRegistration uzerinden
    // yapiliyor.
    let user = await this.prisma.user.findFirst({
      where: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneLast4: dto.phoneLast4,
        registrations: { some: { congressId: congress.id, isActive: true } },
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phoneLast4: dto.phoneLast4,
          registrations: {
            create: {
              congressId: congress.id,
              source: RegistrationSource.PILOT,
            },
          },
        },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      activeCongressId: congress.id,
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
