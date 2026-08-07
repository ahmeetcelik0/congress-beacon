import { parseEmailOrPhone } from './parse-email-or-phone';

describe('parseEmailOrPhone', () => {
  it('@ iceren girdi e-posta sayilir, kucuk harfe cevrilir', () => {
    expect(parseEmailOrPhone('Ali@Example.com')).toEqual({
      type: 'email',
      value: 'ali@example.com',
    });
  });

  it('gecerli telefon (ok) -> phone, E.164', () => {
    expect(parseEmailOrPhone('0532 123 45 67')).toEqual({
      type: 'phone',
      value: '+905321234567',
    });
  });

  it('gecerli formatli ama isValid()=false telefon (suspicious) -> yine de phone, E.164', () => {
    const result = parseEmailOrPhone('+1 (555) 123-4567');
    expect(result).toEqual({ type: 'phone', value: '+15551234567' });
  });

  it('hic parse edilemeyen girdi (unrecognized) -> DB aramasina girmez', () => {
    expect(parseEmailOrPhone('telefon yok')).toEqual({ type: 'unrecognized' });
  });
});
