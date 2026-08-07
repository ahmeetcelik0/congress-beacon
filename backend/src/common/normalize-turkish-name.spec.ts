import {
  normalizeTurkishName,
  computeSearchName,
} from './normalize-turkish-name';

describe('normalizeTurkishName', () => {
  it.each([
    ['Prof. Dr. Ahmet YILMAZ', 'ahmet yilmaz'],
    ['AHMET YILMAZ', 'ahmet yilmaz'],
    ['Doç.Dr. İbrahim Öztürk', 'ibrahim ozturk'],
    ['Uzm. Dr. Şule Çelik', 'sule celik'],
    ['Ayşe Nur KAYA', 'ayse nur kaya'],
    ['Op. Dr.  Mehmet   Demir ', 'mehmet demir'],
    ['Yrd. Doç. Dr. Gülşah Ünal', 'gulsah unal'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeTurkishName(input)).toBe(expected);
  });

  it('bitisik yazilmis coklu unvan (nokta ile, boslukSUZ) da temizlenir', () => {
    expect(normalizeTurkishName('Prof.Dr.Ahmet Yilmaz')).toBe('ahmet yilmaz');
  });

  it('bos string -> bos string', () => {
    expect(normalizeTurkishName('')).toBe('');
  });

  it('yalnizca bosluk -> bos string', () => {
    expect(normalizeTurkishName('   ')).toBe('');
  });

  it('tek kelime (unvansiz) -> oldugu gibi normalize edilir', () => {
    expect(normalizeTurkishName('Ahmet')).toBe('ahmet');
  });

  it('yalnizca unvan -> bos string', () => {
    expect(normalizeTurkishName('Dr.')).toBe('');
    expect(normalizeTurkishName('Prof. Dr.')).toBe('');
  });

  it('MD/PhD gibi Latin unvanlar da taninir', () => {
    expect(normalizeTurkishName('Ahmet Yilmaz, MD, PhD')).toBe('ahmet yilmaz');
  });

  it('ayni isim farkli unvan/bicimlerle ayni sonuca indirgenir (eslestirmenin temeli)', () => {
    const variants = [
      'Prof. Dr. Şule Çelik',
      'ŞULE ÇELİK',
      'sule celik',
      'Şule  Çelik',
    ];
    const normalized = variants.map(normalizeTurkishName);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('sule celik');
  });
});

describe('computeSearchName', () => {
  it('ad ve soyadi birlestirip normalize eder', () => {
    expect(computeSearchName('Ahmet', 'Yılmaz')).toBe('ahmet yilmaz');
  });

  it('unvanli soyad alaninda da (nadir ama) unvanlari temizler', () => {
    expect(computeSearchName('Şule', 'Dr. Çelik')).toBe('sule celik');
  });
});
