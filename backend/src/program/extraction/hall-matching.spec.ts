import { matchHall, buildHallCreationCandidates } from './hall-matching';

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

describe('buildHallCreationCandidates', () => {
  it('farkli yazim varyasyonlarini tek adaya birlestirir', () => {
    expect(
      buildHallCreationCandidates(['Salon B', 'SALON B', 'Salon-B', 'salon b']),
    ).toEqual(['Salon B']);
  });

  it('goruntulenen isim olarak grupta ILK gorulen yazimi tutar', () => {
    expect(buildHallCreationCandidates(['salon c', 'Salon C'])).toEqual([
      'salon c',
    ]);
  });

  it('birden fazla farkli salon adi ayri adaylar olarak kalir', () => {
    expect(buildHallCreationCandidates(['Salon B', 'Salon C'])).toEqual([
      'Salon B',
      'Salon C',
    ]);
  });

  it('bos/null degerleri aday olarak saymaz', () => {
    expect(buildHallCreationCandidates([null, '', '   ', 'Salon B'])).toEqual([
      'Salon B',
    ]);
  });

  it('bos girdi listesi bos dizi doner', () => {
    expect(buildHallCreationCandidates([])).toEqual([]);
  });
});
