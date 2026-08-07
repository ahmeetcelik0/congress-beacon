import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ImportRowStatus,
  ImportStatus,
  Prisma,
  RegistrationSource,
} from '../../../generated/prisma/client';
import { derivePhoneLast4 } from '../../common/normalize-phone';
import { RegistrationImportParserService } from './registration-import-parser.service';
import { classifyRawRow } from './classify-raw-row';
import { ImportRowsQueryDto } from '../dto/import-rows-query.dto';
import { UpdateImportRowDto } from '../dto/update-import-row.dto';

export type UploadedFileLike = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class RegistrationImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: RegistrationImportParserService,
  ) {}

  async createImport(
    congressId: string,
    adminId: string,
    file: UploadedFileLike,
  ) {
    const congress = await this.prisma.congress.findUnique({
      where: { id: congressId },
    });
    if (!congress) {
      throw new NotFoundException('Kongre bulunamadi');
    }

    const { rows, recognizedColumns, unrecognizedColumns } =
      await this.parser.parse(file.buffer);

    const importRecord = await this.prisma.registrationImport.create({
      data: {
        congressId,
        adminUserId: adminId,
        fileName: file.originalname,
        totalRows: rows.length,
      },
    });

    if (rows.length > 0) {
      await this.prisma.registrationImportRow.createMany({
        data: rows.map((row) => ({
          importId: importRecord.id,
          rowNumber: row.rowNumber,
          rawFirstName: row.rawFirstName,
          rawLastName: row.rawLastName,
          rawEmail: row.rawEmail,
          rawPhone: row.rawPhone,
          normalizedEmail: row.normalizedEmail,
          normalizedPhone: row.normalizedPhone,
          externalId: row.externalId,
          status: row.status,
          message: row.message,
          warning: row.warning,
          matchedUserId: row.matchedUserId,
        })),
      });
    }

    return {
      importId: importRecord.id,
      totalRows: rows.length,
      counts: {
        new: rows.filter((r) => r.status === ImportRowStatus.NEW).length,
        matched: rows.filter((r) => r.status === ImportRowStatus.MATCHED)
          .length,
        duplicate: rows.filter((r) => r.status === ImportRowStatus.DUPLICATE)
          .length,
        invalid: rows.filter((r) => r.status === ImportRowStatus.INVALID)
          .length,
        warnings: rows.filter((r) => r.warning !== null).length,
      },
      recognizedColumns,
      unrecognizedColumns,
    };
  }

  listImports(congressId: string) {
    return this.prisma.registrationImport.findMany({
      where: { congressId },
      orderBy: { createdAt: 'desc' },
      include: { adminUser: { select: { name: true, email: true } } },
    });
  }

  private async findImportOrThrow(importId: string) {
    const importRecord = await this.prisma.registrationImport.findUnique({
      where: { id: importId },
    });
    if (!importRecord) {
      throw new NotFoundException('Yukleme bulunamadi');
    }
    return importRecord;
  }

  async getImportDetail(importId: string, query: ImportRowsQueryDto) {
    const importRecord = await this.findImportOrThrow(importId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.RegistrationImportRowWhereInput = {
      importId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total, statusCounts] = await Promise.all([
      this.prisma.registrationImportRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.registrationImportRow.count({ where }),
      this.prisma.registrationImportRow.groupBy({
        by: ['status'],
        where: { importId },
        _count: { _all: true },
      }),
    ]);

    return {
      import: importRecord,
      rows,
      total,
      page,
      pageSize,
      counts: Object.fromEntries(
        statusCounts.map((c) => [c.status, c._count._all]),
      ),
    };
  }

  // Satiri duzelt: ham alanlari gunceller, sonra durumu VE uyariyi
  // yeniden hesaplar. Tek-satir siniflandirmadan (classifyRawRow) sonra
  // - eger sonuc INVALID degilse - kardes satirlar arasinda tekrar VE
  // DB'de eslesme yeniden kontrol edilir (duzeltme onceki DUPLICATE/
  // MATCHED durumunu degistirmis olabilir).
  async updateRow(importId: string, rowId: string, dto: UpdateImportRowDto) {
    const importRecord = await this.findImportOrThrow(importId);
    if (importRecord.status !== ImportStatus.DRAFT) {
      throw new ConflictException('Bu yukleme artik duzenlenemez');
    }

    const row = await this.prisma.registrationImportRow.findUnique({
      where: { id: rowId },
    });
    if (!row || row.importId !== importId) {
      throw new NotFoundException('Satir bulunamadi');
    }

    const rawFirstName =
      dto.firstName !== undefined
        ? dto.firstName.trim() || null
        : row.rawFirstName;
    const rawLastName =
      dto.lastName !== undefined
        ? dto.lastName.trim() || null
        : row.rawLastName;
    const rawEmail =
      dto.email !== undefined ? dto.email.trim() || null : row.rawEmail;
    const rawPhone =
      dto.phone !== undefined ? dto.phone.trim() || null : row.rawPhone;

    const classification = classifyRawRow({
      rawFirstName,
      rawLastName,
      rawEmail,
      rawPhone,
    });

    let status: ImportRowStatus = classification.status;
    let matchedUserId: string | null = null;

    if (status === ImportRowStatus.NEW) {
      const siblings = await this.prisma.registrationImportRow.findMany({
        where: {
          importId,
          id: { not: rowId },
          status: { in: [ImportRowStatus.NEW, ImportRowStatus.MATCHED] },
        },
        select: { normalizedEmail: true, normalizedPhone: true },
      });
      const isDuplicate = siblings.some(
        (sibling) =>
          (classification.normalizedEmail &&
            sibling.normalizedEmail === classification.normalizedEmail) ||
          (classification.normalizedPhone &&
            sibling.normalizedPhone === classification.normalizedPhone),
      );

      if (isDuplicate) {
        status = ImportRowStatus.DUPLICATE;
      } else {
        const existingUser = classification.normalizedEmail
          ? await this.prisma.user.findUnique({
              where: { email: classification.normalizedEmail },
            })
          : classification.normalizedPhone
            ? await this.prisma.user.findUnique({
                where: { phone: classification.normalizedPhone },
              })
            : null;
        if (existingUser) {
          status = ImportRowStatus.MATCHED;
          matchedUserId = existingUser.id;
        }
      }
    }

    return this.prisma.registrationImportRow.update({
      where: { id: rowId },
      data: {
        rawFirstName,
        rawLastName,
        rawEmail,
        rawPhone,
        normalizedEmail: classification.normalizedEmail,
        normalizedPhone: classification.normalizedPhone,
        status,
        message: classification.message,
        warning: classification.warning,
        matchedUserId,
      },
    });
  }

  async excludeRow(importId: string, rowId: string) {
    const importRecord = await this.findImportOrThrow(importId);
    if (importRecord.status !== ImportStatus.DRAFT) {
      throw new ConflictException('Bu yukleme artik duzenlenemez');
    }

    const row = await this.prisma.registrationImportRow.findUnique({
      where: { id: rowId },
    });
    if (!row || row.importId !== importId) {
      throw new NotFoundException('Satir bulunamadi');
    }

    return this.prisma.registrationImportRow.update({
      where: { id: rowId },
      data: { status: ImportRowStatus.EXCLUDED },
    });
  }

  async cancelImport(importId: string) {
    const importRecord = await this.findImportOrThrow(importId);
    if (importRecord.status !== ImportStatus.DRAFT) {
      throw new ConflictException('Bu yukleme zaten sonuclandirilmis');
    }

    return this.prisma.registrationImport.update({
      where: { id: importId },
      data: { status: ImportStatus.CANCELLED },
    });
  }

  // Tek transaction icinde: NEW ve MATCHED satirlari islenir, DUPLICATE/
  // INVALID/EXCLUDED atlanir. phone/email unique cakismasi (parse ile onay
  // arasinda DB degismis olabilir - ornegin ayni kisiyi iceren iki ayri
  // import ust uste onaylandiginda) o satiri DUPLICATE'e cevirip atlar,
  // transaction'i BOZMAZ (bkz. docs/decisions.md).
  async approveImport(importId: string) {
    const importRecord = await this.findImportOrThrow(importId);
    if (importRecord.status !== ImportStatus.DRAFT) {
      throw new ConflictException('Bu yukleme zaten sonuclandirilmis');
    }

    const rows = await this.prisma.registrationImportRow.findMany({
      where: {
        importId,
        status: { in: [ImportRowStatus.NEW, ImportRowStatus.MATCHED] },
      },
      orderBy: { rowNumber: 'asc' },
    });

    return this.prisma.$transaction(async (tx) => {
      let createdUsers = 0;
      let updatedUsers = 0;
      let createdRegistrations = 0;
      let skipped = 0;

      for (const row of rows) {
        try {
          if (row.status === ImportRowStatus.MATCHED && row.matchedUserId) {
            const user = await tx.user.findUnique({
              where: { id: row.matchedUserId },
            });
            if (!user) {
              await tx.registrationImportRow.update({
                where: { id: row.id },
                data: {
                  status: ImportRowStatus.INVALID,
                  message: 'Eslesen kullanici artik bulunamiyor',
                },
              });
              skipped++;
              continue;
            }

            const patch: Prisma.UserUpdateInput = {};
            if (!user.email && row.normalizedEmail)
              patch.email = row.normalizedEmail;
            if (!user.phone && row.normalizedPhone)
              patch.phone = row.normalizedPhone;
            if (!user.phoneRaw && row.rawPhone) patch.phoneRaw = row.rawPhone;
            if (!user.phoneLast4 && row.rawPhone) {
              patch.phoneLast4 = derivePhoneLast4(
                row.normalizedPhone,
                row.rawPhone,
              );
            }
            if (Object.keys(patch).length > 0) {
              await tx.user.update({ where: { id: user.id }, data: patch });
              updatedUsers++;
            }

            const existingRegistration =
              await tx.congressRegistration.findUnique({
                where: {
                  congressId_userId: {
                    congressId: importRecord.congressId,
                    userId: user.id,
                  },
                },
              });
            if (existingRegistration) {
              await tx.congressRegistration.update({
                where: { id: existingRegistration.id },
                data: {
                  isActive: true,
                  ...(row.externalId ? { externalId: row.externalId } : {}),
                },
              });
            } else {
              await tx.congressRegistration.create({
                data: {
                  congressId: importRecord.congressId,
                  userId: user.id,
                  source: RegistrationSource.IMPORT,
                  externalId: row.externalId,
                },
              });
              createdRegistrations++;
            }
          } else if (row.status === ImportRowStatus.NEW) {
            const user = await tx.user.create({
              data: {
                firstName: row.rawFirstName ?? '',
                lastName: row.rawLastName ?? '',
                email: row.normalizedEmail,
                phone: row.normalizedPhone,
                phoneRaw: row.rawPhone,
                phoneLast4: derivePhoneLast4(
                  row.normalizedPhone,
                  row.rawPhone ?? '',
                ),
              },
            });
            createdUsers++;

            await tx.congressRegistration.create({
              data: {
                congressId: importRecord.congressId,
                userId: user.id,
                source: RegistrationSource.IMPORT,
                externalId: row.externalId,
              },
            });
            createdRegistrations++;
          }
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            await tx.registrationImportRow.update({
              where: { id: row.id },
              data: {
                status: ImportRowStatus.DUPLICATE,
                message:
                  'Onay sirasinda ayni e-posta/telefon baska bir kayitla cakisti',
              },
            });
            skipped++;
            continue;
          }
          throw error;
        }
      }

      await tx.registrationImport.update({
        where: { id: importId },
        data: { status: ImportStatus.APPROVED, approvedAt: new Date() },
      });

      return { createdUsers, updatedUsers, createdRegistrations, skipped };
    });
  }
}
