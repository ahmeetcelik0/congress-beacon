import {
  normalizePhone,
  derivePhoneLast4,
  PHONE_SUSPICIOUS_WARNING,
  PHONE_UNPARSEABLE_WARNING,
} from './normalize-phone';

describe('normalizePhone', () => {
  it('TR yerel format (0 ile basliyor) -> ok, E.164', () => {
    const result = normalizePhone('0532 123 45 67');
    expect(result).toEqual({ status: 'ok', e164: '+905321234567' });
  });

  it('TR yerel format (0 olmadan, 10 hane) -> ok, E.164', () => {
    const result = normalizePhone('5321234567');
    expect(result).toEqual({ status: 'ok', e164: '+905321234567' });
  });

  it('TR uluslararasi format (+90) -> ok, E.164', () => {
    const result = normalizePhone('+90 532 123 45 67');
    expect(result).toEqual({ status: 'ok', e164: '+905321234567' });
  });

  it('Ingiltere numarasi (+44) -> varsayilan TR yok sayilir, ok', () => {
    const result = normalizePhone('+44 20 7946 0958');
    expect(result).toEqual({ status: 'ok', e164: '+442079460958' });
  });

  it('00 oneki ile Ingiltere numarasi -> ok, ayni E.164', () => {
    const result = normalizePhone('0044 20 7946 0958');
    expect(result).toEqual({ status: 'ok', e164: '+442079460958' });
  });

  it('ABD numarasi (555 alan kodu - gercekte kullanilmaz) -> suspicious', () => {
    const result = normalizePhone('+1 (555) 123-4567');
    expect(result.status).toBe('suspicious');
    if (result.status === 'suspicious') {
      expect(result.e164).toBe('+15551234567');
      expect(result.warning).toBe(PHONE_SUSPICIOUS_WARNING);
    }
  });

  it('harf iceren anlamsiz metin -> unparseable', () => {
    const result = normalizePhone('telefon yok');
    expect(result).toEqual({
      status: 'unparseable',
      warning: PHONE_UNPARSEABLE_WARNING,
    });
  });

  it('bos string -> unparseable', () => {
    const result = normalizePhone('   ');
    expect(result.status).toBe('unparseable');
  });
});

describe('derivePhoneLast4', () => {
  it('normalize E.164 varsa onun son 4 rakamini kullanir', () => {
    expect(derivePhoneLast4('+905321234567', '0532 123 45 67')).toBe('4567');
  });

  it('normalize deger yoksa ham metindeki son 4 rakami kullanir', () => {
    expect(derivePhoneLast4(null, 'tel: 98-76 (ofis)')).toBe('9876');
  });

  it('ham metinde hic rakam yoksa null doner', () => {
    expect(derivePhoneLast4(null, 'telefon yok')).toBeNull();
  });
});
