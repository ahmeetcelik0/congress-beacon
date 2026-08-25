import { combineIstanbulDateTime } from './congress-time';

// Faz 12: bu testler `process.env.TZ`den BAĞIMSIZ aynı sonucu vermelidir -
// asıl kanıtladığımız şey bu (bkz. docs/decisions.md "Faz 12"). Eski
// hatada testler `result.getHours()` (yerel saat) kontrol ediyordu ve
// hem yazma hem okuma aynı yerel saati kullandığı için hata hiçbir zaman
// dilimi ile yakalanamıyordu - bu yüzden burada YALNIZCA `toISOString()`
// (mutlak, dilimsiz UTC gösterim) kontrol edilir.
describe('combineIstanbulDateTime', () => {
  it('yaz saatinde (İstanbul her zaman UTC+3) doğru UTC üretir', () => {
    const result = combineIstanbulDateTime('2026-09-01', '15:00');
    expect(result?.toISOString()).toBe('2026-09-01T12:00:00.000Z');
  });

  it('kış aylarında da aynı sabit +3 farkı uygular (Türkiye yaz saati uygulamıyor)', () => {
    const result = combineIstanbulDateTime('2026-01-15', '23:45');
    expect(result?.toISOString()).toBe('2026-01-15T20:45:00.000Z');
  });

  it('gün başlangıcını doğru çevirir (00:00 İstanbul -> önceki gün 21:00 UTC)', () => {
    const result = combineIstanbulDateTime('2026-09-10', '00:00');
    expect(result?.toISOString()).toBe('2026-09-09T21:00:00.000Z');
  });

  it('geçersiz tarih biçiminde null döner', () => {
    expect(combineIstanbulDateTime('10-09-2026', '09:30')).toBeNull();
    expect(combineIstanbulDateTime('bugün', '09:30')).toBeNull();
  });

  it('geçersiz saat biçiminde null döner', () => {
    expect(combineIstanbulDateTime('2026-09-10', '9-30')).toBeNull();
    expect(combineIstanbulDateTime('2026-09-10', 'öğleden sonra')).toBeNull();
  });

  it('saat/dakika sınır dışıysa null döner', () => {
    expect(combineIstanbulDateTime('2026-09-10', '25:00')).toBeNull();
    expect(combineIstanbulDateTime('2026-09-10', '10:75')).toBeNull();
  });
});
