import { validateExtractionResult } from './validate-extraction-result';

function baseValid() {
  return {
    schemaVersion: '1.0',
    congress: { name: 'Test Kongresi', startDate: '2026-09-10' },
    days: [
      {
        date: '2026-09-10',
        label: '1. Gün',
        halls: [
          {
            name: 'Ankara Salonu',
            events: [
              {
                startTime: '09:00',
                endTime: '10:00',
                type: 'session',
                title: 'Açılış Oturumu',
                keywords: ['girişimsel kardiyoloji'],
                chairs: ['Prof. Dr. Şule Çelik'],
                panelists: [],
                items: [
                  {
                    startTime: '09:00',
                    endTime: '09:30',
                    type: 'presentation',
                    code: 'ZS 001',
                    title: 'Açılış Konuşması',
                    speakers: ['Prof. Dr. Şule Çelik'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('validateExtractionResult', () => {
  it('geçerli bir kanonik program için valid:true döner ve varsayılanları uygular', () => {
    const result = validateExtractionResult(baseValid());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.result.congress.venue).toBeNull();
      expect(result.result.congress.endDate).toBeNull();
      expect(result.result.days[0].halls[0].events[0].panelists).toEqual([]);
    }
  });

  it('kök nesne değilse hata döner', () => {
    const result = validateExtractionResult('bozuk json');
    expect(result.valid).toBe(false);
  });

  it("'days' dizisi boşsa Türkçe hata döner", () => {
    const data = baseValid();
    (data as { days: unknown[] }).days = [];
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.includes("'days' dizisi boş olamaz")),
      ).toBe(true);
    }
  });

  it('zorunlu bir alan eksikse konumlu ve Türkçe hata döner', () => {
    const data = baseValid();
    delete (data.days[0].halls[0].events[0] as Record<string, unknown>)
      .startTime;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(
        /1\. gün.*1\. salon.*Ankara Salonu.*1\. etkinlik.*'startTime' alanı eksik/,
      );
    }
  });

  it('hall.name eksikse gün/salon konumu (isim olmadan) doğru raporlanır', () => {
    const data = baseValid();
    delete (data.days[0].halls[0] as Record<string, unknown>).name;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("'name' alanı eksik"))).toBe(
        true,
      );
    }
  });

  it('geçersiz event.type değeri için izin verilenleri listeleyen hata döner', () => {
    const data = baseValid();
    (data.days[0].halls[0].events[0] as Record<string, unknown>).type =
      'yanlış-tip';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/'type' alanı geçersiz değerde/);
    }
  });

  it('hatalı saat biçimi konumlu hata döner', () => {
    const data = baseValid();
    data.days[0].halls[0].events[0].startTime = '25:99';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(
        /'startTime' alanı geçersiz saat biçiminde/,
      );
    }
  });

  it('hatalı tarih biçimi konumlu hata döner', () => {
    const data = baseValid();
    data.days[0].date = '10-09-2026';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/'date' alanı geçersiz tarih biçiminde/);
    }
  });

  it('şemada tanımsız fazladan bir alan reddedilir', () => {
    const data = baseValid();
    (data.days[0].halls[0].events[0] as Record<string, unknown>).fooBar = 'x';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/tanımsız bir alan var: 'fooBar'/);
    }
  });

  it("endTime, startTime'dan önce veya aynıysa hata döner", () => {
    const data = baseValid();
    data.days[0].halls[0].events[0].endTime = '09:00';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(
        /'endTime' alanı 'startTime' alanından önce veya aynı olamaz/,
      );
    }
  });

  it("öğenin endTime'ı startTime'dan önceyse hata döner", () => {
    const data = baseValid();
    data.days[0].halls[0].events[0].items[0].endTime = '09:00';
    data.days[0].halls[0].events[0].items[0].startTime = '09:15';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/1\. öğe.*'endTime'/);
    }
  });

  it('nullable alanların null değeri geçerlidir (LLM boş bilgi raporlarken kullandığı biçim)', () => {
    const data = baseValid();
    (data.days[0].halls[0].events[0] as Record<string, unknown>).series = null;
    (data.days[0].halls[0].events[0] as Record<string, unknown>).titleEn = null;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(true);
  });

  it('opsiyonel bir alan hiç yazılmasa da geçerlidir (kullanıcının elle yazdığı JSON)', () => {
    const data = baseValid();
    delete (data.days[0].halls[0].events[0] as Record<string, unknown>).series;
    delete (data.days[0].halls[0] as Record<string, unknown>).nameEn;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.result.days[0].halls[0].events[0].series).toBeNull();
      expect(result.result.days[0].halls[0].nameEn).toBeNull();
    }
  });

  it("'discussion' tipi öğe konuşmacısız da geçerlidir", () => {
    const data = baseValid();
    data.days[0].halls[0].events[0].items.push({
      startTime: '09:30',
      endTime: '09:40',
      type: 'discussion',
      code: null,
      title: 'Tartışma',
      speakers: [],
    });
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(true);
  });

  it('birden fazla hata varsa hepsi birden döner (tek tek düzeltme turu istemez)', () => {
    const data = baseValid();
    delete (data.days[0].halls[0].events[0] as Record<string, unknown>).title;
    data.days[0].halls[0].events[0].startTime = 'geçersiz';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
