import { parseCanonicalDate, combineDateAndTime } from './derive-datetime';

describe('parseCanonicalDate', () => {
  it('geçerli bir ISO tarihi olduğu gibi (string) döner', () => {
    expect(parseCanonicalDate('2026-09-10')).toBe('2026-09-10');
  });

  it('geçersiz biçimde null döner', () => {
    expect(parseCanonicalDate('10-09-2026')).toBeNull();
    expect(parseCanonicalDate('bugün')).toBeNull();
  });
});

// Faz 12: bu testler ARTIK `result.getHours()` (sunucunun CALISTIGI
// ortamin yerel saatine bagimli getter) DEGIL, `toISOString()` (mutlak,
// dilimsiz UTC gosterim) kontrol ediyor - eski test bu yuzden hatayi hic
// YAKALAYAMIYORDU (bkz. docs/decisions.md "Faz 12": TZ=UTC ile calistirilinca
// da eski testler 6/6 geciyordu, cunku hem yazma hem okuma AYNI yerel
// saati kullaniyordu). Asil kanit: bu testler `TZ=UTC` ile de
// `TZ=Europe/Istanbul` ile de AYNI sonucu vermeli.
describe('combineDateAndTime', () => {
  it('"10 Eylül 09:30 Türkiye saati" -> doğru UTC üretir', () => {
    const result = combineDateAndTime('2026-09-10', '09:30');
    expect(result?.toISOString()).toBe('2026-09-10T06:30:00.000Z');
  });

  it('geçersiz saat biçiminde null döner', () => {
    expect(combineDateAndTime('2026-09-10', '9-30')).toBeNull();
    expect(combineDateAndTime('2026-09-10', 'öğleden sonra')).toBeNull();
  });

  it('saat/dakika sınır dışıysa null döner', () => {
    expect(combineDateAndTime('2026-09-10', '25:00')).toBeNull();
    expect(combineDateAndTime('2026-09-10', '10:75')).toBeNull();
  });

  it('geçersiz gün tarihinde null döner', () => {
    expect(combineDateAndTime('10-09-2026', '09:30')).toBeNull();
  });

  it('gün sınırını doğru geçer (23:59 -> ertesi gün UTC 20:59)', () => {
    const result = combineDateAndTime('2026-09-10', '23:59');
    expect(result?.toISOString()).toBe('2026-09-10T20:59:00.000Z');
  });
});
