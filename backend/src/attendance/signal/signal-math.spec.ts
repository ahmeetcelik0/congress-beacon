import {
  isHampelOutlier,
  median,
  medianAbsoluteDeviation,
  nextEma,
  softmaxPercentages,
} from './signal-math';

describe('median', () => {
  it('tek sayida elemanda ortadaki degeri doner', () => {
    expect(median([-70, -60, -80])).toBe(-70);
  });

  it('cift sayida elemanda ortadaki ikisinin ortalamasini doner', () => {
    expect(median([-70, -60, -80, -90])).toBe(-75);
  });

  it('girdi dizisini degistirmez', () => {
    const values = [-70, -60, -80];
    median(values);
    expect(values).toEqual([-70, -60, -80]);
  });
});

describe('medianAbsoluteDeviation', () => {
  it('medyandan sapmalarin medyanini hesaplar', () => {
    const values = [-72, -70, -68, -70, -71];
    // sapmalar: 2, 0, 2, 0, 1 -> sirali: 0, 0, 1, 2, 2 -> medyan 1
    expect(medianAbsoluteDeviation(values, median(values))).toBe(1);
  });

  it('tum degerler ayniysa 0 doner', () => {
    expect(medianAbsoluteDeviation([-70, -70, -70], -70)).toBe(0);
  });
});

describe('isHampelOutlier', () => {
  const k = 3;
  const windowSize = 5;

  it('pencere dolmadan hicbir okumayi elemez', () => {
    expect(isHampelOutlier(-10, [-70, -71, -70], k, windowSize)).toBe(false);
  });

  it('suruden kopan okumayi eler', () => {
    const window = [-72, -70, -68, -70, -71];
    expect(isHampelOutlier(-40, window, k, windowSize)).toBe(true);
  });

  it('normal dalgalanmayi kabul eder', () => {
    const window = [-72, -70, -68, -70, -71];
    expect(isHampelOutlier(-73, window, k, windowSize)).toBe(false);
  });

  it('MAD = 0 iken filtreyi devre disi birakir (kilitlenmeyi onler)', () => {
    // Telefon sabit dururken RSSI ayni degere kuantalanir. Bu korumasiz,
    // medyandan 1 dB farkli her okuma sonsuza kadar reddedilirdi.
    const window = [-70, -70, -70, -70, -70];
    expect(isHampelOutlier(-71, window, k, windowSize)).toBe(false);
    expect(isHampelOutlier(-95, window, k, windowSize)).toBe(false);
  });
});

describe('nextEma', () => {
  it('ilk okumada ham degeri doner', () => {
    expect(nextEma(null, -70, 0.35)).toBe(-70);
  });

  it('bilinen dizide beklenen yumusatilmis degeri uretir', () => {
    // alpha = 0.5: (-70, -60) -> -65, sonra -80 -> -72.5
    const first = nextEma(null, -70, 0.5);
    const second = nextEma(first, -60, 0.5);
    expect(second).toBe(-65);
    expect(nextEma(second, -80, 0.5)).toBe(-72.5);
  });

  it('kucuk alpha ile yeni okumanin etkisini sinirlar', () => {
    // alpha = 0.2 -> 0.2 * -50 + 0.8 * -70 = -66
    expect(nextEma(-70, -50, 0.2)).toBeCloseTo(-66, 10);
  });
});

describe('softmaxPercentages', () => {
  const temperature = 8;

  it('bos girdide bos sonuc doner', () => {
    expect(softmaxPercentages(new Map(), temperature).size).toBe(0);
  });

  it('yuzdelerin toplami 100 eder', () => {
    const result = softmaxPercentages(
      new Map([
        ['salon-1', -85],
        ['salon-2', -64],
        ['salon-3', -90],
      ]),
      temperature,
    );
    const total = [...result.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it('en guclu sinyalli salona en yuksek yuzdeyi verir', () => {
    const result = softmaxPercentages(
      new Map([
        ['salon-1', -85],
        ['salon-2', -64],
        ['salon-3', -90],
      ]),
      temperature,
    );
    expect(result.get('salon-2')!).toBeGreaterThan(result.get('salon-1')!);
    expect(result.get('salon-1')!).toBeGreaterThan(result.get('salon-3')!);
    // 21 dB'lik fark, T=8 ile net bir kazanan uretir (~%90)
    expect(result.get('salon-2')!).toBeGreaterThan(85);
  });

  it('tek salon goruluyorsa zayif sinyalde bile %100 doner', () => {
    // Bu, yuzdeyi "sinyal kalitesi" sanmanin neden yanlis oldugunu gosterir;
    // gercek koruma Hall.rssiThreshold kapisidir.
    const result = softmaxPercentages(new Map([['salon-1', -95]]), temperature);
    expect(result.get('salon-1')!).toBeCloseTo(100, 10);
  });

  it('esit ortalamalarda yuzdeleri esit dagitir', () => {
    const result = softmaxPercentages(
      new Map([
        ['salon-1', -70],
        ['salon-2', -70],
      ]),
      temperature,
    );
    expect(result.get('salon-1')!).toBeCloseTo(50, 10);
    expect(result.get('salon-2')!).toBeCloseTo(50, 10);
  });

  it('cok negatif degerlerde tasma yasamaz', () => {
    const result = softmaxPercentages(
      new Map([
        ['salon-1', -100],
        ['salon-2', -99],
      ]),
      temperature,
    );
    for (const value of result.values()) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect([...result.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(
      100,
      10,
    );
  });
});
