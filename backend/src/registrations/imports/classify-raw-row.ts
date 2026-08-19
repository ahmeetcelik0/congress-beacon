import { isEmail } from 'class-validator';
import {
  normalizePhone,
  PHONE_SUSPICIOUS_WARNING,
  PHONE_UNPARSEABLE_WARNING,
} from '../../common/normalize-phone';

export type RawRowInput = {
  rawFirstName: string | null;
  rawLastName: string | null;
  rawEmail: string | null;
  rawPhone: string | null;
};

export type RowClassification = {
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  // MATCHED/DUPLICATE bu asamada belirlenmez - DB'ye ve dosyanin diger
  // satirlarina bakmayi gerektirir (bkz. RegistrationImportParserService).
  // Bu fonksiyon yalnizca "bu satir tek basina islenebilir mi" sorusunu
  // cevaplar.
  status: 'INVALID' | 'NEW';
  message: string | null;
  warning: string | null;
};

// Kullanilabilir telefon = normalize edilebilmis (ok/suspicious - E.164
// uretilmis) VEYA ham metinde en az 7 rakam var.
function hasUsablePhone(
  rawPhone: string | null,
  normalizedPhone: string | null,
): boolean {
  if (normalizedPhone) return true;
  if (!rawPhone) return false;
  const digitCount = (rawPhone.match(/\d/g) ?? []).length;
  return digitCount >= 7;
}

// Satir durumu kurallari (bu sirayla):
//
// INVALID yalnizca uc durumda:
//   1) Ad VE soyad ikisi de bos.
//   2) E-posta dolu ama formati bozuk VE telefon da yok (Kural 3, daha
//      SPESIFIK mesaj oldugu icin asagidaki genel kuraldan ONCE kontrol
//      edilir - e-posta hic girilmemis olmakla bozuk girilmis olmak
//      farkli mesajlar hak ediyor).
//   3) Gecerli bir e-posta VE kullanilabilir bir telefon ikisi de yok
//      (e-posta hic girilmemisse buraya duser).
//
// Bunlarin disinda satir islenebilir - sorunlar warning'e yazilir, satiri
// bloke etmez.
export function classifyRawRow(raw: RawRowInput): RowClassification {
  const firstName = raw.rawFirstName?.trim() || null;
  const lastName = raw.rawLastName?.trim() || null;
  const emailRaw = raw.rawEmail?.trim() || null;
  const phoneRaw = raw.rawPhone?.trim() || null;

  if (!firstName && !lastName) {
    return {
      normalizedEmail: null,
      normalizedPhone: null,
      status: 'INVALID',
      message: 'Ad ve soyad zorunlu',
      warning: null,
    };
  }

  const emailValid = emailRaw !== null && isEmail(emailRaw);
  const emailInvalid = emailRaw !== null && !emailValid;
  const normalizedEmail = emailValid ? emailRaw.toLowerCase() : null;

  const phoneResult = phoneRaw ? normalizePhone(phoneRaw) : null;
  const normalizedPhone =
    phoneResult && phoneResult.status !== 'unparseable'
      ? phoneResult.e164
      : null;
  const phoneUsable = hasUsablePhone(phoneRaw, normalizedPhone);

  if (!phoneUsable) {
    if (emailInvalid) {
      return {
        normalizedEmail: null,
        normalizedPhone,
        status: 'INVALID',
        message: 'E-posta adresi geçersiz',
        warning: null,
      };
    }
    if (!normalizedEmail) {
      return {
        normalizedEmail: null,
        normalizedPhone,
        status: 'INVALID',
        message:
          'E-posta veya telefon zorunlu — bu bilgiler olmadan katılımcı giriş yapamaz',
        warning: null,
      };
    }
  }

  const warnings: string[] = [];
  if (emailInvalid) {
    warnings.push('E-posta adresi geçersiz, yok sayıldı');
  }
  if (phoneResult?.status === 'unparseable') {
    warnings.push(PHONE_UNPARSEABLE_WARNING);
  } else if (phoneResult?.status === 'suspicious') {
    warnings.push(PHONE_SUSPICIOUS_WARNING);
  }
  if ((firstName && !lastName) || (!firstName && lastName)) {
    warnings.push('Ad veya soyad eksik');
  }

  return {
    normalizedEmail,
    normalizedPhone,
    status: 'NEW',
    message: null,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  };
}
