import { buildEtag } from './etag';

describe('buildEtag', () => {
  it('cift tirnak icinde bir hex hash doner', () => {
    const etag = buildEtag({ count: 3, max: '2026-08-08T10:00:00.000Z' });
    expect(etag).toMatch(/^"[0-9a-f]{40}"$/);
  });

  it('ayni seed icin deterministik (ayni etag) uretir', () => {
    const seed = { count: 3, max: '2026-08-08T10:00:00.000Z' };
    expect(buildEtag(seed)).toBe(buildEtag(seed));
  });

  it('farkli sayim FARKLI etag uretir (silme durumunu yakalar)', () => {
    const a = buildEtag({ count: 3, max: '2026-08-08T10:00:00.000Z' });
    const b = buildEtag({ count: 2, max: '2026-08-08T10:00:00.000Z' });
    expect(a).not.toBe(b);
  });

  it('farkli max updatedAt FARKLI etag uretir', () => {
    const a = buildEtag({ count: 3, max: '2026-08-08T10:00:00.000Z' });
    const b = buildEtag({ count: 3, max: '2026-08-08T11:00:00.000Z' });
    expect(a).not.toBe(b);
  });
});
