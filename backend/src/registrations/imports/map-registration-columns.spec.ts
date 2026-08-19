import { mapRegistrationColumns } from './map-registration-columns';

describe('mapRegistrationColumns', () => {
  it('standart Turkce basliklari tanir', () => {
    const result = mapRegistrationColumns([
      'Ad',
      'Soyad',
      'E-posta',
      'Telefon',
      'Kayıt No',
    ]);
    expect(result.columnIndex).toEqual({
      firstName: 0,
      lastName: 1,
      email: 2,
      phone: 3,
      externalId: 4,
    });
    expect(result.unrecognizedColumns).toEqual([]);
  });

  it('Ingilizce ve varyant basliklari tanir', () => {
    const result = mapRegistrationColumns([
      'First Name',
      'Last Name',
      'E-mail',
      'GSM',
      'Registration ID',
    ]);
    expect(result.columnIndex).toEqual({
      firstName: 0,
      lastName: 1,
      email: 2,
      phone: 3,
      externalId: 4,
    });
  });

  it('tanimayan kolonlari unrecognizedColumns icine koyar, yok saymaz', () => {
    const result = mapRegistrationColumns(['Ad', 'Şehir', 'Not']);
    expect(result.recognizedColumns).toEqual(['Ad']);
    expect(result.unrecognizedColumns).toEqual(['Şehir', 'Not']);
  });

  it('bos basliklari atlar', () => {
    const result = mapRegistrationColumns(['Ad', '', 'Soyad']);
    expect(result.columnIndex.firstName).toBe(0);
    expect(result.columnIndex.lastName).toBe(2);
  });
});
