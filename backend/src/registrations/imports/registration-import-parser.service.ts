import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportRowStatus } from '../../../generated/prisma/client';
import { readRegistrationFile } from './read-registration-file';
import { mapRegistrationColumns } from './map-registration-columns';
import { classifyRawRow } from './classify-raw-row';

export type ParsedRegistrationRow = {
  rowNumber: number;
  rawFirstName: string | null;
  rawLastName: string | null;
  rawEmail: string | null;
  rawPhone: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  externalId: string | null;
  status: ImportRowStatus;
  message: string | null;
  warning: string | null;
  matchedUserId: string | null;
};

export type ParsedRegistrationFile = {
  rows: ParsedRegistrationRow[];
  recognizedColumns: string[];
  unrecognizedColumns: string[];
};

function cell(row: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const value = row[index]?.trim();
  return value ? value : null;
}

@Injectable()
export class RegistrationImportParserService {
  constructor(private readonly prisma: PrismaService) {}

  async parse(buffer: Buffer): Promise<ParsedRegistrationFile> {
    const { headerRow, dataRows } = readRegistrationFile(buffer);
    const { columnIndex, recognizedColumns, unrecognizedColumns } =
      mapRegistrationColumns(headerRow);

    // Asama 1: her satiri tek basina siniflandir (INVALID mi, degilse
    // normalize edilmis email/phone nedir). DB'ye VE dosyanin diger
    // satirlarina bakmayi gerektirmez (bkz. classifyRawRow).
    const classified = dataRows.map((row, i) => {
      const raw = {
        rawFirstName: cell(row, columnIndex.firstName),
        rawLastName: cell(row, columnIndex.lastName),
        rawEmail: cell(row, columnIndex.email),
        rawPhone: cell(row, columnIndex.phone),
      };
      return {
        rowNumber: i + 2, // 1. satir baslik - ilk veri satiri gercek dosyada 2.
        raw,
        externalId: cell(row, columnIndex.externalId),
        classification: classifyRawRow(raw),
      };
    });

    // Asama 2: dosya-ici tekrar tespiti (sirali - "daha ONCE gorulen"
    // eslesirse DUPLICATE olan budur, ilk gorulen degil). Ayni turda
    // DB eslestirmesi icin aday email/phone kumeleri toplanir.
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const candidateEmails = new Set<string>();
    const candidatePhones = new Set<string>();

    const staged = classified.map((item) => {
      const base = {
        rowNumber: item.rowNumber,
        rawFirstName: item.raw.rawFirstName,
        rawLastName: item.raw.rawLastName,
        rawEmail: item.raw.rawEmail,
        rawPhone: item.raw.rawPhone,
        normalizedEmail: item.classification.normalizedEmail,
        normalizedPhone: item.classification.normalizedPhone,
        externalId: item.externalId,
        message: item.classification.message,
        warning: item.classification.warning,
      };

      if (item.classification.status === 'INVALID') {
        return {
          ...base,
          status: ImportRowStatus.INVALID,
          matchedUserId: null,
        };
      }

      const { normalizedEmail, normalizedPhone } = item.classification;
      const isDuplicate =
        (normalizedEmail !== null && seenEmails.has(normalizedEmail)) ||
        (normalizedPhone !== null && seenPhones.has(normalizedPhone));

      if (isDuplicate) {
        return {
          ...base,
          status: ImportRowStatus.DUPLICATE,
          matchedUserId: null,
        };
      }

      if (normalizedEmail !== null) {
        seenEmails.add(normalizedEmail);
        candidateEmails.add(normalizedEmail);
      }
      if (normalizedPhone !== null) {
        seenPhones.add(normalizedPhone);
        candidatePhones.add(normalizedPhone);
      }

      return { ...base, status: ImportRowStatus.NEW, matchedUserId: null };
    });

    // Asama 3: NEW adaylarini DB'deki mevcut kullanicilarla TEK sorguda
    // eslestir (satir basina ayri sorgu yok). Eslestirme sirasi: (1)
    // normalize e-posta, (2) normalize telefon. Ad-soyad eslestirmesi
    // KULLANILMAZ - bu fazda guvenilir degil (bkz. docs/decisions.md).
    const existingUsers =
      candidateEmails.size > 0 || candidatePhones.size > 0
        ? await this.prisma.user.findMany({
            where: {
              OR: [
                ...(candidateEmails.size > 0
                  ? [{ email: { in: [...candidateEmails] } }]
                  : []),
                ...(candidatePhones.size > 0
                  ? [{ phone: { in: [...candidatePhones] } }]
                  : []),
              ],
            },
            select: { id: true, email: true, phone: true },
          })
        : [];

    const userIdByEmail = new Map(
      existingUsers
        .filter((u) => u.email)
        .map((u) => [u.email as string, u.id]),
    );
    const userIdByPhone = new Map(
      existingUsers
        .filter((u) => u.phone)
        .map((u) => [u.phone as string, u.id]),
    );

    const rows: ParsedRegistrationRow[] = staged.map((row) => {
      if (row.status !== ImportRowStatus.NEW) return row;

      const matchedUserId =
        (row.normalizedEmail
          ? userIdByEmail.get(row.normalizedEmail)
          : undefined) ??
        (row.normalizedPhone
          ? userIdByPhone.get(row.normalizedPhone)
          : undefined) ??
        null;

      return matchedUserId
        ? { ...row, status: ImportRowStatus.MATCHED, matchedUserId }
        : row;
    });

    return { rows, recognizedColumns, unrecognizedColumns };
  }
}
