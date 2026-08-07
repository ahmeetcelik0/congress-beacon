import { classifyRawRow } from './classify-raw-row';

function row(overrides: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return classifyRawRow({
    rawFirstName: overrides.firstName ?? null,
    rawLastName: overrides.lastName ?? null,
    rawEmail: overrides.email ?? null,
    rawPhone: overrides.phone ?? null,
  });
}

describe('classifyRawRow', () => {
  it('temiz satir (ad+soyad+email+telefon) -> NEW, uyarisiz', () => {
    const result = row({
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'ali@example.com',
      phone: '0532 123 45 67',
    });
    expect(result.status).toBe('NEW');
    expect(result.message).toBeNull();
    expect(result.warning).toBeNull();
    expect(result.normalizedEmail).toBe('ali@example.com');
    expect(result.normalizedPhone).toBe('+905321234567');
  });

  it('INVALID: ad ve soyad ikisi de bos', () => {
    const result = row({ email: 'ali@example.com' });
    expect(result.status).toBe('INVALID');
    expect(result.message).toBe('Ad ve soyad zorunlu');
  });

  it('INVALID: e-posta ve telefon ikisi de yok', () => {
    const result = row({ firstName: 'Ali', lastName: 'Yilmaz' });
    expect(result.status).toBe('INVALID');
    expect(result.message).toContain('E-posta veya telefon zorunlu');
  });

  it('INVALID: e-posta bozuk VE telefon yok (daha spesifik mesaj)', () => {
    const result = row({
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'bozuk-mail',
    });
    expect(result.status).toBe('INVALID');
    expect(result.message).toBe('E-posta adresi geçersiz');
  });

  it('kullanilabilir telefon = en az 7 rakamli ham metin (normalize edilemese bile)', () => {
    // "12345678" TR olarak parse edilebilir/edilemez olabilir; en az 7
    // rakam icerdigi icin telefon kullanilabilir sayilmali, e-posta
    // olmasa da satir INVALID olmamali.
    const result = row({
      firstName: 'Ali',
      lastName: 'Yilmaz',
      phone: 'tel: 12345678',
    });
    expect(result.status).toBe('NEW');
  });

  it('warning: e-posta bozuk ama telefon var -> yok sayilir, satir NEW', () => {
    const result = row({
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'bozuk-mail',
      phone: '0532 123 45 67',
    });
    expect(result.status).toBe('NEW');
    expect(result.normalizedEmail).toBeNull();
    expect(result.warning).toContain('E-posta adresi geçersiz, yok sayıldı');
  });

  it('warning: telefon normalize edilemedi (unparseable) ama e-posta var', () => {
    const result = row({
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'ali@example.com',
      phone: 'telefon yok',
    });
    expect(result.status).toBe('NEW');
    expect(result.normalizedPhone).toBeNull();
    expect(result.warning).toContain('Telefon numarası tanınamadı');
  });

  it('warning: telefon parse edildi ama gecersiz (suspicious)', () => {
    const result = row({
      firstName: 'Ali',
      lastName: 'Yilmaz',
      email: 'ali@example.com',
      phone: '+1 (555) 123-4567',
    });
    expect(result.status).toBe('NEW');
    expect(result.normalizedPhone).toBe('+15551234567');
    expect(result.warning).toContain('olağandışı');
  });

  it('warning: ad veya soyaddan yalnizca biri bos', () => {
    const result = row({ firstName: 'Ali', email: 'ali@example.com' });
    expect(result.status).toBe('NEW');
    expect(result.warning).toContain('Ad veya soyad eksik');
  });

  it('birden fazla uyari ayni satirda birlesebilir', () => {
    const result = row({
      firstName: 'Ali',
      email: 'bozuk-mail',
      phone: 'telefon yok',
    });
    // email bozuk + phone unparseable -> ikisi de warning, ama telefon
    // kullanilamaz oldugundan ve email de gecersiz oldugundan INVALID olmali.
    expect(result.status).toBe('INVALID');
  });

  it('yurt disi numara (Ingiltere) gecerli kabul edilir, INVALID OLMAZ', () => {
    const result = row({
      firstName: 'John',
      lastName: 'Smith',
      phone: '+44 20 7946 0958',
    });
    expect(result.status).toBe('NEW');
    expect(result.normalizedPhone).toBe('+442079460958');
    expect(result.warning).toBeNull();
  });
});
