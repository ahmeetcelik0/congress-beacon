import { matchHall } from './hall-matching';

const HALLS = [
  { id: 'hall-1', name: 'Salon A' },
  { id: 'hall-2', name: 'Şükrü Saraçoğlu Salonu' },
];

describe('matchHall', () => {
  it('birebir eslesirse hallId doner, uyari olmaz', () => {
    expect(matchHall('Salon A', HALLS)).toEqual({
      hallId: 'hall-1',
      warning: null,
    });
  });

  it('buyuk/kucuk harf farkini yok sayar', () => {
    expect(matchHall('salon a', HALLS)).toEqual({
      hallId: 'hall-1',
      warning: null,
    });
  });

  it('Turkce karakter farkini yok sayar', () => {
    expect(matchHall('sukru saracoglu salonu', HALLS)).toEqual({
      hallId: 'hall-2',
      warning: null,
    });
  });

  it('fazla bosluklari sadelestirir', () => {
    expect(matchHall('  Salon   A  ', HALLS)).toEqual({
      hallId: 'hall-1',
      warning: null,
    });
  });

  it('eslesme yoksa hallId null + uyari doner', () => {
    expect(matchHall('Salon Z', HALLS)).toEqual({
      hallId: null,
      warning: 'Salon eşleşmedi, panelden seçin',
    });
  });

  it('salon adi belgede yoksa (null) farkli bir uyari doner', () => {
    expect(matchHall(null, HALLS)).toEqual({
      hallId: null,
      warning: 'Salon adı belgede yoktu, panelden seçin',
    });
  });

  it('bos string de "belgede yok" olarak degerlendirilir', () => {
    expect(matchHall('   ', HALLS)).toEqual({
      hallId: null,
      warning: 'Salon adı belgede yoktu, panelden seçin',
    });
  });
});
