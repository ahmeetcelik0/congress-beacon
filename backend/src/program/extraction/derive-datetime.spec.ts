import {
  buildDayDateMap,
  combineDateAndTime,
  resolveDayDate,
} from './derive-datetime';

describe('buildDayDateMap', () => {
  it('belgede tarih varsa oldugu gibi kullanir (turetilmez)', () => {
    const map = buildDayDateMap(
      [{ label: '1. Gün', date: '2026-09-01' }],
      new Date(2026, 0, 1),
    );
    const info = map.get('1. Gün');
    expect(info?.derived).toBe(false);
    expect(info?.date?.getFullYear()).toBe(2026);
    expect(info?.date?.getMonth()).toBe(8); // 0-indexed Eylul
    expect(info?.date?.getDate()).toBe(1);
  });

  it('belgede tarih yoksa kongrenin startDate + gun sirasindan turetir', () => {
    const congressStart = new Date(2026, 8, 1); // 1 Eylul 2026
    const map = buildDayDateMap(
      [
        { label: '1. Gün', date: null },
        { label: '2. Gün', date: null },
      ],
      congressStart,
    );

    const day1 = map.get('1. Gün');
    expect(day1?.derived).toBe(true);
    expect(day1?.date?.getDate()).toBe(1);

    const day2 = map.get('2. Gün');
    expect(day2?.derived).toBe(true);
    expect(day2?.date?.getDate()).toBe(2);
  });

  it('ne belgede tarih ne kongre startDate varsa date null kalir', () => {
    const map = buildDayDateMap([{ label: '1. Gün', date: null }], null);
    const info = map.get('1. Gün');
    expect(info?.date).toBeNull();
    expect(info?.derived).toBe(false);
  });

  it('gecersiz bir tarih string i turetmeye duser', () => {
    const congressStart = new Date(2026, 8, 1);
    const map = buildDayDateMap(
      [{ label: '1. Gün', date: 'gecersiz-tarih' }],
      congressStart,
    );
    const info = map.get('1. Gün');
    expect(info?.derived).toBe(true);
    expect(info?.date?.getDate()).toBe(1);
  });
});

describe('resolveDayDate', () => {
  it('dayLabel null ise date null + derived false doner', () => {
    const map = buildDayDateMap(
      [{ label: '1. Gün', date: '2026-09-01' }],
      null,
    );
    expect(resolveDayDate(null, map)).toEqual({ date: null, derived: false });
  });

  it('haritada olmayan bir etiket icin de guvenli varsayilan doner', () => {
    const map = buildDayDateMap(
      [{ label: '1. Gün', date: '2026-09-01' }],
      null,
    );
    expect(resolveDayDate('Olmayan Gün', map)).toEqual({
      date: null,
      derived: false,
    });
  });
});

describe('combineDateAndTime', () => {
  const day = new Date(2026, 8, 1);

  it('gecerli HH:MM ile dogru DateTime uretir', () => {
    const result = combineDateAndTime(day, '09:30');
    expect(result?.getHours()).toBe(9);
    expect(result?.getMinutes()).toBe(30);
    expect(result?.getDate()).toBe(1);
  });

  it('date null ise null doner', () => {
    expect(combineDateAndTime(null, '09:30')).toBeNull();
  });

  it('rawTime null ise null doner', () => {
    expect(combineDateAndTime(day, null)).toBeNull();
  });

  it('gecersiz formatli saat icin null doner', () => {
    expect(combineDateAndTime(day, '9-30')).toBeNull();
    expect(combineDateAndTime(day, 'ogleden sonra')).toBeNull();
  });

  it('gecerli araligin disindaki saat/dakika icin null doner', () => {
    expect(combineDateAndTime(day, '25:00')).toBeNull();
    expect(combineDateAndTime(day, '10:75')).toBeNull();
  });
});
