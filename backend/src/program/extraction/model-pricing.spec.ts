import { estimateCostUsd, getModelPricing } from './model-pricing';

describe('getModelPricing', () => {
  it('bilinen bir model icin fiyat tablosu doner', () => {
    expect(getModelPricing('claude-opus-4-8')).toEqual({
      inputPerMTok: 5,
      outputPerMTok: 25,
    });
  });

  it('bilinmeyen bir model icin null doner', () => {
    expect(getModelPricing('claude-hic-boyle-bir-model')).toBeNull();
  });
});

describe('estimateCostUsd', () => {
  it('1M girdi + 1M cikti token icin liste fiyatinin toplamini doner', () => {
    const cost = estimateCostUsd('claude-opus-4-8', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(5 + 25, 6);
  });

  it('kucuk token sayilari icin orantili hesaplar', () => {
    const cost = estimateCostUsd('claude-sonnet-5', 100_000, 50_000);
    // 100k/1M * 3 + 50k/1M * 15 = 0.3 + 0.75
    expect(cost).toBeCloseTo(0.3 + 0.75, 6);
  });

  it('bilinmeyen model icin null doner (asla sessizce 0 gostermez)', () => {
    expect(estimateCostUsd('bilinmeyen-model', 1000, 1000)).toBeNull();
  });
});
