import { validateExtractionResult } from './validate-extraction-result';

function baseValid() {
  return {
    days: [{ label: '1. Gün', date: '2026-04-09' }],
    sessions: [
      {
        dayLabel: '1. Gün',
        hallName: 'Salon A',
        startTime: '09:00',
        endTime: '10:00',
        title: 'Açılış Oturumu',
        sessionType: 'panel',
        keywords: ['girişimsel kardiyoloji'],
        moderators: ['Prof. Dr. Şule Çelik'],
        discussants: [],
        presentations: [
          {
            title: 'Açılış Konuşması',
            startTime: '09:00',
            endTime: '09:15',
            speakers: ['Prof. Dr. Şule Çelik'],
          },
        ],
      },
    ],
  };
}

describe('validateExtractionResult', () => {
  it('geçerli bir ExtractionResult için valid:true döner', () => {
    const result = validateExtractionResult(baseValid());
    expect(result.valid).toBe(true);
  });

  it('kök nesne değilse hata döner', () => {
    const result = validateExtractionResult('bozuk json');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/JSON nesnesi olmalı/);
    }
  });

  it("'days' dizisi boşsa Türkçe hata döner", () => {
    const data = baseValid();
    data.days = [];
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("'days' dizisi boş olamaz");
    }
  });

  it("'sessions' dizisi boşsa Türkçe hata döner", () => {
    const data = baseValid();
    data.sessions = [];
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("'sessions' dizisi boş olamaz");
    }
  });

  it("3. oturumda 'startTime' alanı eksikse konumlu hata döner", () => {
    const data = baseValid();
    data.sessions.push(
      { ...baseValid().sessions[0] },
      { ...baseValid().sessions[0] },
    );
    delete (data.sessions[2] as Record<string, unknown>).startTime;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("3. oturumda 'startTime' alanı eksik");
    }
  });

  it("2. oturumun 1. sunumunda 'title' boşsa (null) geçerli sayılır, ama alan eksikse hata döner", () => {
    const data = baseValid();
    data.sessions.push({ ...baseValid().sessions[0] });
    (data.sessions[1].presentations[0] as Record<string, unknown>).title = null;
    const nullResult = validateExtractionResult(data);
    expect(nullResult.valid).toBe(true);

    delete (data.sessions[1].presentations[0] as Record<string, unknown>).title;
    const missingResult = validateExtractionResult(data);
    expect(missingResult.valid).toBe(false);
    if (!missingResult.valid) {
      expect(missingResult.errors).toContain(
        "2. oturumun 1. sunumunda 'title' alanı eksik",
      );
    }
  });

  it('hatalı saat biçimi konumlu hata döner', () => {
    const data = baseValid();
    data.sessions[0].startTime = '25:99';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(
        /1\. oturumda 'startTime'.*saat biçiminde/,
      );
    }
  });

  it('hatalı tarih biçimi konumlu hata döner', () => {
    const data = baseValid();
    data.days[0].date = '09-04-2026';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/1\. günde 'date'.*tarih biçiminde/);
    }
  });

  it('yanlış tipte bir dizi alanı hata döner', () => {
    const data = baseValid();
    (data.sessions[0] as Record<string, unknown>).keywords = 'tek metin';
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain(
        "1. oturumda 'keywords' alanı bir dizi olmalı",
      );
    }
  });

  it('nullable alanların null değeri geçerlidir (LLM boş bilgi raporlarken kullandığı biçim)', () => {
    const data = baseValid();
    (data.sessions[0] as Record<string, unknown>).sessionType = null;
    (data.sessions[0] as Record<string, unknown>).hallName = null;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(true);
  });

  it("'days' alanı hiç yoksa hata döner", () => {
    const data = baseValid() as Record<string, unknown>;
    delete data.days;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("'days' alanı eksik");
    }
  });

  it('birden fazla hata varsa hepsi birden döner (tek tek düzeltme turu istemez)', () => {
    const data = baseValid();
    data.days = [];
    delete (data.sessions[0] as Record<string, unknown>).title;
    const result = validateExtractionResult(data);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
