import { parseCanonicalDate, combineDateAndTime } from './derive-datetime';

describe('parseCanonicalDate', () => {
  it('geçerli bir ISO tarihi Date nesnesine çevirir', () => {
    const date = parseCanonicalDate('2026-09-10');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(10);
  });

  it('geçersiz biçimde null döner', () => {
    expect(parseCanonicalDate('10-09-2026')).toBeNull();
    expect(parseCanonicalDate('bugün')).toBeNull();
  });
});

describe('combineDateAndTime', () => {
  const day = new Date(2026, 8, 10);

  it('gün tarihi + saat metnini birleştirir', () => {
    const result = combineDateAndTime(day, '09:30');
    expect(result?.getHours()).toBe(9);
    expect(result?.getMinutes()).toBe(30);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(8);
    expect(result?.getDate()).toBe(10);
  });

  it('geçersiz saat biçiminde null döner', () => {
    expect(combineDateAndTime(day, '9-30')).toBeNull();
    expect(combineDateAndTime(day, 'öğleden sonra')).toBeNull();
  });

  it('saat/dakika sınır dışıysa null döner', () => {
    expect(combineDateAndTime(day, '25:00')).toBeNull();
    expect(combineDateAndTime(day, '10:75')).toBeNull();
  });

  it('gün tarihini bozmadan yalnızca saat/dakika değiştirir', () => {
    const result = combineDateAndTime(day, '23:59');
    expect(result?.getHours()).toBe(23);
    expect(result?.getMinutes()).toBe(59);
    // orijinal `day` nesnesi mutasyona uğramamalı
    expect(day.getHours()).toBe(0);
  });
});
