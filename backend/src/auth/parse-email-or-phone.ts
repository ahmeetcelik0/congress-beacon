import { normalizePhone } from '../common/normalize-phone';

export type ParsedIdentifier =
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string }
  // Telefon hic parse edilemedi (bkz. normalizePhone 'unparseable') - DB'de
  // hicbir 'phone' degeriyle aranmamali (null ile arama, telefonu gercekten
  // bos olan bir kullaniciyi yanlislikla eslestirir).
  | { type: 'unrecognized' };

// '@' iceren girdi e-posta sayilir (kucuk harfe normalize edilir); digeri
// telefon sayilip normalizePhone ile E.164'e cevrilir. 'suspicious' (parse
// edildi ama gecersiz) durumunda da E.164 degeri KULLANILIR - import
// akisiyla ayni kural (bkz. common/normalize-phone.ts): kirli veri girisi
// engellememeli. Yalnizca hic parse edilemeyen girdi 'unrecognized' olur.
export function parseEmailOrPhone(input: string): ParsedIdentifier {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return { type: 'email', value: trimmed.toLowerCase() };
  }

  const phoneResult = normalizePhone(trimmed);
  if (phoneResult.status === 'unparseable') {
    return { type: 'unrecognized' };
  }
  return { type: 'phone', value: phoneResult.e164 };
}
