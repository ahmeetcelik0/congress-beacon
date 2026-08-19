import { estimateCostUsd, getModelPricing } from './model-pricing';

const DURING_PROMO = new Date('2026-08-15T00:00:00.000Z');
const AFTER_PROMO = new Date('2026-09-01T00:00:00.000Z');
const LAST_INSTANT_OF_PROMO = new Date('2026-08-31T23:59:59.999Z');

describe('getModelPricing', () => {
  it('claude-opus-4-8 icin tarihten bagimsiz sabit fiyat doner', () => {
    expect(getModelPricing('claude-opus-4-8', DURING_PROMO)).toEqual({
      inputPerMTok: 5,
      outputPerMTok: 25,
    });
    expect(getModelPricing('claude-opus-4-8', AFTER_PROMO)).toEqual({
      inputPerMTok: 5,
      outputPerMTok: 25,
    });
  });

  it('claude-sonnet-5: tanitim donemi icinde ($2/$10) tanitim fiyati doner', () => {
    expect(getModelPricing('claude-sonnet-5', DURING_PROMO)).toEqual({
      inputPerMTok: 2,
      outputPerMTok: 10,
    });
  });

  it('claude-sonnet-5: tanitim doneminin son anina kadar hala tanitim fiyati gecerli', () => {
    expect(getModelPricing('claude-sonnet-5', LAST_INSTANT_OF_PROMO)).toEqual({
      inputPerMTok: 2,
      outputPerMTok: 10,
    });
  });

  it('claude-sonnet-5: tanitim donemi bittikten sonra resmi liste fiyatina ($3/$15) doner', () => {
    expect(getModelPricing('claude-sonnet-5', AFTER_PROMO)).toEqual({
      inputPerMTok: 3,
      outputPerMTok: 15,
    });
  });

  it('bilinmeyen bir model icin null doner', () => {
    expect(
      getModelPricing('claude-hic-boyle-bir-model', DURING_PROMO),
    ).toBeNull();
  });
});

describe('estimateCostUsd', () => {
  it('1M girdi + 1M cikti token icin liste fiyatinin toplamini doner (opus)', () => {
    const cost = estimateCostUsd(
      'claude-opus-4-8',
      1_000_000,
      1_000_000,
      DURING_PROMO,
    );
    expect(cost).toBeCloseTo(5 + 25, 6);
  });

  it('kucuk token sayilari icin tanitim doneminde orantili hesaplar (sonnet)', () => {
    const cost = estimateCostUsd(
      'claude-sonnet-5',
      100_000,
      50_000,
      DURING_PROMO,
    );
    // 100k/1M * 2 + 50k/1M * 10 = 0.2 + 0.5
    expect(cost).toBeCloseTo(0.2 + 0.5, 6);
  });

  it('kucuk token sayilari icin tanitim donemi SONRASINDA orantili hesaplar (sonnet)', () => {
    const cost = estimateCostUsd(
      'claude-sonnet-5',
      100_000,
      50_000,
      AFTER_PROMO,
    );
    // 100k/1M * 3 + 50k/1M * 15 = 0.3 + 0.75
    expect(cost).toBeCloseTo(0.3 + 0.75, 6);
  });

  it('ayni token sayilari tanitim donemi oncesi/sonrasi FARKLI maliyet uretir', () => {
    const during = estimateCostUsd(
      'claude-sonnet-5',
      61674,
      22395,
      DURING_PROMO,
    );
    const after = estimateCostUsd('claude-sonnet-5', 61674, 22395, AFTER_PROMO);
    expect(during).not.toBeCloseTo(after!, 2);
    expect(during!).toBeLessThan(after!);
  });

  it('asOf verilmezse varsayilan olarak simdiki zamani kullanir (atmaz, sayisal bir sonuc doner)', () => {
    const cost = estimateCostUsd('claude-opus-4-8', 1000, 1000);
    expect(typeof cost).toBe('number');
  });

  it('bilinmeyen model icin null doner (asla sessizce 0 gostermez)', () => {
    expect(
      estimateCostUsd('bilinmeyen-model', 1000, 1000, DURING_PROMO),
    ).toBeNull();
  });
});
