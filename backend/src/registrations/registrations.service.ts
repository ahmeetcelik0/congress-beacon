import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RegistrationSource } from '../../generated/prisma/client';
import { derivePhoneLast4, normalizePhone } from '../common/normalize-phone';
import { computeSearchName } from '../common/normalize-turkish-name';
import { RegistrationsQueryDto } from './dto/registrations-query.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';

// E-posta/telefon girdisini User modeline yazilacak {email, phone, phoneRaw,
// phoneLast4} setine cevirir - manuel ekleme VE duzenleme AYNI kurali
// kullanir (Excel import satir kuraliyla tutarli): normalize edilemeyen
// telefon 'phone' alanina YAZILMAZ, yalnizca phoneRaw'da yasar.
function buildContactFields(email?: string, phone?: string) {
  const trimmedEmail = email?.trim();
  const normalizedEmail = trimmedEmail ? trimmedEmail.toLowerCase() : null;

  const trimmedPhone = phone?.trim();
  const phoneResult = trimmedPhone ? normalizePhone(trimmedPhone) : null;
  const normalizedPhone =
    phoneResult && phoneResult.status !== 'unparseable'
      ? phoneResult.e164
      : null;

  return {
    email: normalizedEmail,
    phone: normalizedPhone,
    phoneRaw: trimmedPhone ?? null,
    phoneLast4: trimmedPhone
      ? derivePhoneLast4(normalizedPhone, trimmedPhone)
      : null,
  };
}

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: RegistrationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CongressRegistrationWhereInput = {
      congressId: query.congressId,
      ...(query.source ? { source: query.source } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { firstName: { contains: query.search } },
                { lastName: { contains: query.search } },
                { email: { contains: query.search } },
                { phone: { contains: query.search } },
                { phoneRaw: { contains: query.search } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.congressRegistration.findMany({
        where,
        include: { user: true },
        orderBy: { registeredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.congressRegistration.count({ where }),
    ]);

    return {
      items: items.map((registration) => ({
        registrationId: registration.id,
        userId: registration.user.id,
        firstName: registration.user.firstName,
        lastName: registration.user.lastName,
        email: registration.user.email,
        phone: registration.user.phone,
        phoneRaw: registration.user.phoneRaw,
        source: registration.source,
        isActive: registration.isActive,
        registeredAt: registration.registeredAt,
        hasPassword: registration.user.passwordHash !== null,
        lastLoginAt: registration.user.lastLoginAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  // Manuel ekleme: mevcut kullaniciyla eslesirse YENI KULLANICI
  // OLUSTURULMAZ, yalnizca kayit eklenir/yeniden aktiflestirilir.
  async createManual(dto: CreateRegistrationDto) {
    const congress = await this.prisma.congress.findUnique({
      where: { id: dto.congressId },
    });
    if (!congress) {
      throw new NotFoundException('Kongre bulunamadi');
    }

    const contact = buildContactFields(dto.email, dto.phone);
    const hasUsablePhone =
      contact.phone !== null ||
      (contact.phoneRaw !== null &&
        (contact.phoneRaw.match(/\d/g) ?? []).length >= 7);
    if (!contact.email && !hasUsablePhone) {
      throw new BadRequestException(
        'E-posta veya telefon zorunlu — bu bilgiler olmadan katılımcı giriş yapamaz',
      );
    }

    let user = contact.email
      ? await this.prisma.user.findUnique({ where: { email: contact.email } })
      : null;
    if (!user && contact.phone) {
      user = await this.prisma.user.findUnique({
        where: { phone: contact.phone },
      });
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          searchName: computeSearchName(dto.firstName, dto.lastName),
          email: contact.email,
          phone: contact.phone,
          phoneRaw: contact.phoneRaw,
          phoneLast4: contact.phoneLast4,
        },
      });
    } else {
      const patch: Prisma.UserUpdateInput = {};
      if (!user.email && contact.email) patch.email = contact.email;
      if (!user.phone && contact.phone) patch.phone = contact.phone;
      if (!user.phoneRaw && contact.phoneRaw) patch.phoneRaw = contact.phoneRaw;
      if (!user.phoneLast4 && contact.phoneLast4)
        patch.phoneLast4 = contact.phoneLast4;
      if (Object.keys(patch).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: patch,
        });
      }
    }

    const existingRegistration =
      await this.prisma.congressRegistration.findUnique({
        where: {
          congressId_userId: { congressId: dto.congressId, userId: user.id },
        },
      });

    if (existingRegistration) {
      if (existingRegistration.isActive) {
        throw new ConflictException('Bu kullanici zaten bu kongreye kayitli');
      }
      return this.prisma.congressRegistration.update({
        where: { id: existingRegistration.id },
        data: { isActive: true },
      });
    }

    return this.prisma.congressRegistration.create({
      data: {
        congressId: dto.congressId,
        userId: user.id,
        source: RegistrationSource.MANUAL,
      },
    });
  }

  private async findRegistrationOrThrow(id: string) {
    const registration = await this.prisma.congressRegistration.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!registration) {
      throw new NotFoundException('Kayit bulunamadi');
    }
    return registration;
  }

  async update(id: string, dto: UpdateRegistrationDto) {
    const registration = await this.findRegistrationOrThrow(id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      // Kismi PATCH: yalnizca biri gonderilmis olabilir, digeri icin kayitli
      // degeri kullan - aksi halde searchName eksik/yanlis isimden hesaplanir.
      data.searchName = computeSearchName(
        dto.firstName ?? registration.user.firstName,
        dto.lastName ?? registration.user.lastName,
      );
    }
    if (dto.email !== undefined) {
      const trimmed = dto.email.trim();
      data.email = trimmed ? trimmed.toLowerCase() : null;
    }
    if (dto.phone !== undefined) {
      const contact = buildContactFields(undefined, dto.phone);
      data.phone = contact.phone;
      data.phoneRaw = contact.phoneRaw;
      data.phoneLast4 = contact.phoneLast4;
    }

    try {
      return await this.prisma.user.update({
        where: { id: registration.userId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu e-posta veya telefon başka bir kullanıcıya ait',
        );
      }
      throw error;
    }
  }

  async deactivate(id: string) {
    await this.findRegistrationOrThrow(id);
    return this.prisma.congressRegistration.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivate(id: string) {
    await this.findRegistrationOrThrow(id);
    return this.prisma.congressRegistration.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
