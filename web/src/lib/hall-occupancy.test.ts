import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOccupancy,
  countActiveHalls,
  getOccupancyStatus,
  mergeHallOccupancyWithCapacity,
  minutesBetween,
  formatDurationMinutes,
  formatConfidence,
  hasMoreRoster,
  describeRosterCoverage,
  mergeRosterPage,
} from './hall-occupancy.ts';

test('calculateOccupancy: 0/100 -> %0', () => {
  const result = calculateOccupancy(0, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.displayPercentage, 0);
    assert.equal(result.isOverCapacity, false);
  }
});

test('calculateOccupancy: 50/100 -> %50', () => {
  const result = calculateOccupancy(50, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.displayPercentage, 50);
    assert.equal(result.chartPercentage, 50);
  }
});

test('calculateOccupancy: 100/100 -> %100, tam kapasitede asma yok', () => {
  const result = calculateOccupancy(100, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.displayPercentage, 100);
    assert.equal(result.isOverCapacity, false);
    assert.equal(result.overflowCount, 0);
  }
});

test('calculateOccupancy: 125/100 -> gercek %125, chart %100, overflow 25', () => {
  const result = calculateOccupancy(125, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.rawPercentage, 125);
    assert.equal(result.displayPercentage, 125);
    assert.equal(result.chartPercentage, 100);
    assert.equal(result.isOverCapacity, true);
    assert.equal(result.overflowCount, 25);
  }
});

test('calculateOccupancy: capacity null -> yuzde yok (no-capacity)', () => {
  const result = calculateOccupancy(42, null);
  assert.equal(result.kind, 'no-capacity');
  assert.equal(result.count, 42);
});

test('calculateOccupancy: capacity 0 -> gecersiz kapasite, sifira bolme yok', () => {
  const result = calculateOccupancy(10, 0);
  assert.equal(result.kind, 'invalid-capacity');
});

test('calculateOccupancy: negatif capacity -> gecersiz kapasite', () => {
  const result = calculateOccupancy(10, -5);
  assert.equal(result.kind, 'invalid-capacity');
});

test('calculateOccupancy: negatif occupancy -> guvenli fallback (0 kabul edilir)', () => {
  const result = calculateOccupancy(-7, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.count, 0);
    assert.equal(result.displayPercentage, 0);
  }
});

test('calculateOccupancy: kusuratli yuzde tanimli sekilde yuvarlanir', () => {
  const result = calculateOccupancy(1, 3);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.ok(Math.abs(result.rawPercentage - 33.333) < 0.01);
    assert.equal(result.displayPercentage, 33);
  }
});

test('calculateOccupancy: cok buyuk sayilar NaN/Infinity uretmez', () => {
  const result = calculateOccupancy(1_000_000, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.ok(Number.isFinite(result.rawPercentage));
    assert.ok(Number.isFinite(result.displayPercentage));
    assert.equal(result.chartPercentage, 100);
    assert.equal(result.isOverCapacity, true);
  }
});

test('getOccupancyStatus: bilinmiyor (capacity null)', () => {
  const status = getOccupancyStatus(calculateOccupancy(10, null));
  assert.equal(status.key, 'unknown');
  assert.equal(status.tone, 'neutral');
});

test('getOccupancyStatus: dusuk (%0-49)', () => {
  const status = getOccupancyStatus(calculateOccupancy(30, 100));
  assert.equal(status.key, 'low');
  assert.equal(status.tone, 'positive');
});

test('getOccupancyStatus: orta (%50-74)', () => {
  const status = getOccupancyStatus(calculateOccupancy(60, 100));
  assert.equal(status.key, 'medium');
  assert.equal(status.tone, 'info');
});

test('getOccupancyStatus: yuksek (%75-89)', () => {
  const status = getOccupancyStatus(calculateOccupancy(80, 100));
  assert.equal(status.key, 'high');
  assert.equal(status.tone, 'warning');
});

test('getOccupancyStatus: doluya yakin / dolu (%90-100)', () => {
  const nearFull = getOccupancyStatus(calculateOccupancy(95, 100));
  const full = getOccupancyStatus(calculateOccupancy(100, 100));
  assert.equal(nearFull.key, 'near-full');
  assert.equal(full.key, 'full');
  assert.equal(nearFull.tone, 'critical');
  assert.equal(full.tone, 'critical');
});

test('getOccupancyStatus: kapasite asildi (%100 uzeri)', () => {
  const status = getOccupancyStatus(calculateOccupancy(125, 100));
  assert.equal(status.key, 'over-capacity');
  assert.equal(status.tone, 'critical');
});

// --- getOccupancyStatus: raw yuzde uzerinden sinir testleri (yuvarlama
// karar mantigina KARISMAZ) ---

test('getOccupancyStatus siniri: raw %49 -> dusuk', () => {
  const result = calculateOccupancy(49, 100);
  const status = getOccupancyStatus(result);
  assert.equal(result.rawPercentage, 49);
  assert.equal(status.key, 'low');
});

test('getOccupancyStatus siniri: raw %49.9 -> dusuk (yuvarlaninca 50 olsa bile)', () => {
  const result = calculateOccupancy(4990, 10000);
  assert.ok(Math.abs(result.rawPercentage - 49.9) < 0.001);
  assert.equal(result.displayPercentage, 50);
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'low');
});

test('getOccupancyStatus siniri: raw %50 -> orta', () => {
  const result = calculateOccupancy(50, 100);
  const status = getOccupancyStatus(result);
  assert.equal(result.rawPercentage, 50);
  assert.equal(status.key, 'medium');
});

test('getOccupancyStatus siniri: raw %74.9 -> orta', () => {
  const result = calculateOccupancy(7490, 10000);
  assert.ok(Math.abs(result.rawPercentage - 74.9) < 0.001);
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'medium');
});

test('getOccupancyStatus siniri: raw %75 -> yuksek', () => {
  const result = calculateOccupancy(75, 100);
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'high');
});

test('getOccupancyStatus siniri: raw %89.9 -> yuksek', () => {
  const result = calculateOccupancy(8990, 10000);
  assert.ok(Math.abs(result.rawPercentage - 89.9) < 0.001);
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'high');
});

test('getOccupancyStatus siniri: raw %90 -> doluya yakin', () => {
  const result = calculateOccupancy(90, 100);
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'near-full');
});

test('getOccupancyStatus siniri: raw %99.5 -> doluya yakin (yuvarlaninca 100 olsa bile Dolu OLMAZ)', () => {
  const result = calculateOccupancy(199, 200);
  assert.equal(result.rawPercentage, 99.5);
  assert.equal(result.displayPercentage, 100);
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'near-full');
  assert.notEqual(status.key, 'full');
});

test('getOccupancyStatus: count === capacity -> Dolu (tam sayi esitligi)', () => {
  const result = calculateOccupancy(250, 250);
  const status = getOccupancyStatus(result);
  assert.equal(result.isOverCapacity, false);
  assert.equal(status.key, 'full');
});

test('getOccupancyStatus: capacity=201,count=202 -> Kapasite asildi (yuvarlanmis %100 degil, isOverCapacity oncelikli)', () => {
  const result = calculateOccupancy(202, 201);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.ok(Math.abs(result.rawPercentage - 100.4975124378109) < 0.0001);
    assert.equal(result.displayPercentage, 100);
    assert.equal(result.isOverCapacity, true);
    assert.equal(result.overflowCount, 1);
  }
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'over-capacity');
  assert.notEqual(status.key, 'full');
});

test('getOccupancyStatus: capacity=1000,count=995 -> Doluya yakin, Dolu DEGIL', () => {
  const result = calculateOccupancy(995, 1000);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.rawPercentage, 99.5);
    assert.equal(result.isOverCapacity, false);
  }
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'near-full');
});

test('getOccupancyStatus: capacity=100,count=101 -> Kapasite asildi', () => {
  const result = calculateOccupancy(101, 100);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.isOverCapacity, true);
    assert.equal(result.overflowCount, 1);
  }
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'over-capacity');
});

test('getOccupancyStatus: capacity=null -> bilinmiyor', () => {
  const status = getOccupancyStatus(calculateOccupancy(10, null));
  assert.equal(status.key, 'unknown');
});

test('getOccupancyStatus: capacity=0 -> gecersiz-kapasite (mevcut davranis korunuyor)', () => {
  const result = calculateOccupancy(10, 0);
  assert.equal(result.kind, 'invalid-capacity');
  const status = getOccupancyStatus(result);
  assert.equal(status.key, 'unknown');
});

// --- countActiveHalls ---

test('countActiveHalls: bos liste -> 0', () => {
  assert.equal(countActiveHalls([]), 0);
});

test('countActiveHalls: tum salonlar 0 kisi -> 0', () => {
  assert.equal(
    countActiveHalls([
      { hallId: 'a', count: 0 },
      { hallId: 'b', count: 0 },
    ]),
    0,
  );
});

test('countActiveHalls: occupancy [0,1,5] -> 2 aktif', () => {
  assert.equal(
    countActiveHalls([
      { hallId: 'a', count: 0 },
      { hallId: 'b', count: 1 },
      { hallId: 'c', count: 5 },
    ]),
    2,
  );
});

test('countActiveHalls: negatif occupancy sayilmaz', () => {
  assert.equal(
    countActiveHalls([
      { hallId: 'a', count: -3 },
      { hallId: 'b', count: 2 },
    ]),
    1,
  );
});

test('countActiveHalls: NaN/gecersiz occupancy sayilmaz', () => {
  assert.equal(
    countActiveHalls([
      { hallId: 'a', count: NaN },
      { hallId: 'b', count: 4 },
    ]),
    1,
  );
});

test('countActiveHalls: capacity null olsa da occupancy>0 ise sayilir', () => {
  // countActiveHalls capacity almaz, yalnizca hallId+count kullanir --
  // capacity'nin null olup olmamasi hesaba hic girmez.
  assert.equal(countActiveHalls([{ hallId: 'a', count: 3 }]), 1);
});

test('countActiveHalls: ayni hallId iki kez gelirse deterministik (son kayit esas alinir), iki kez SAYILMAZ', () => {
  assert.equal(
    countActiveHalls([
      { hallId: 'a', count: 5 },
      { hallId: 'a', count: 0 },
    ]),
    0,
  );
  assert.equal(
    countActiveHalls([
      { hallId: 'a', count: 0 },
      { hallId: 'a', count: 5 },
    ]),
    1,
  );
});

test('mergeHallOccupancyWithCapacity: hallId ile dogru esler', () => {
  const merged = mergeHallOccupancyWithCapacity(
    [
      { hallId: 'a', hallName: 'Salon 1', count: 10 },
      { hallId: 'b', hallName: 'Salon 2', count: 5 },
    ],
    [
      { id: 'a', capacity: 50 },
      { id: 'b', capacity: null },
    ],
  );
  assert.deepEqual(merged, [
    { hallId: 'a', hallName: 'Salon 1', count: 10, capacity: 50 },
    { hallId: 'b', hallName: 'Salon 2', count: 5, capacity: null },
  ]);
});

test('mergeHallOccupancyWithCapacity: halls listesinde olmayan hallId -> capacity null', () => {
  const merged = mergeHallOccupancyWithCapacity(
    [{ hallId: 'missing', hallName: 'Bilinmeyen', count: 1 }],
    [],
  );
  assert.equal(merged[0].capacity, null);
});

test('minutesBetween + formatDurationMinutes: 0 dk', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  const minutes = minutesBetween('2026-01-01T10:00:00Z', null, now);
  assert.equal(minutes, 0);
  assert.equal(formatDurationMinutes(minutes), '<1 dk');
});

test('minutesBetween + formatDurationMinutes: 1 dk', () => {
  const now = Date.parse('2026-01-01T10:01:00Z');
  const minutes = minutesBetween('2026-01-01T10:00:00Z', null, now);
  assert.equal(minutes, 1);
  assert.equal(formatDurationMinutes(minutes), '1 dk');
});

test('formatDurationMinutes: 59 dk', () => {
  assert.equal(formatDurationMinutes(59), '59 dk');
});

test('formatDurationMinutes: 60 dk -> 1 sa', () => {
  assert.equal(formatDurationMinutes(60), '1 sa');
});

test('formatDurationMinutes: 61 dk -> 1 sa 1 dk', () => {
  assert.equal(formatDurationMinutes(61), '1 sa 1 dk');
});

test('formatDurationMinutes: cok saat', () => {
  assert.equal(formatDurationMinutes(25 * 60), '25 sa');
  assert.equal(formatDurationMinutes(25 * 60 + 5), '25 sa 5 dk');
});

test('formatDurationMinutes: gecersiz/negatif -> guvenli fallback', () => {
  assert.equal(formatDurationMinutes(-5), '—');
  assert.equal(formatDurationMinutes(NaN), '—');
});

test('minutesBetween: gecersiz baslangic tarihi -> NaN, guvenli formatlanir', () => {
  const minutes = minutesBetween('not-a-date', null, Date.now());
  assert.ok(Number.isNaN(minutes));
  assert.equal(formatDurationMinutes(minutes), '—');
});

test('minutesBetween: bitis baslangictan once olsa bile negatif sure yok', () => {
  const minutes = minutesBetween('2026-01-01T10:05:00Z', '2026-01-01T10:00:00Z', Date.now());
  assert.equal(minutes, 0);
});

test('formatConfidence: skor varsa yuzde + etiket', () => {
  assert.equal(formatConfidence('yuksek', 87.6), '%88 · yuksek');
});

test('formatConfidence: skor yoksa yalniz etiket', () => {
  assert.equal(formatConfidence('orta', null), 'orta');
});

test('formatConfidence: hicbiri yoksa -', () => {
  assert.equal(formatConfidence(null, null), '—');
});

// --- hasMoreRoster / describeRosterCoverage (100 katilimci siniri duzeltmesi) ---

test('hasMoreRoster: loaded=0/total=0 -> daha fazla yok', () => {
  assert.equal(hasMoreRoster(0, 0), false);
});

test('hasMoreRoster: loaded=100/total=995 -> daha fazla var', () => {
  assert.equal(hasMoreRoster(100, 995), true);
});

test('hasMoreRoster: loaded=100/total=100 -> daha fazla yok', () => {
  assert.equal(hasMoreRoster(100, 100), false);
});

test('hasMoreRoster: loaded=0/total=995 -> daha fazla var (ac salon senaryosu)', () => {
  assert.equal(hasMoreRoster(0, 995), true);
});

test('hasMoreRoster: gecersiz/negatif girdiler guvenli sekilde 0a dusurulur', () => {
  assert.equal(hasMoreRoster(NaN, 995), true);
  assert.equal(hasMoreRoster(-5, 995), true);
  assert.equal(hasMoreRoster(10, NaN), false);
  assert.equal(hasMoreRoster(10, -5), false);
});

test('describeRosterCoverage: dogru bicimlendirme', () => {
  assert.equal(describeRosterCoverage(100, 995), '100 / 995 kişi gösteriliyor');
  assert.equal(describeRosterCoverage(0, 995), '0 / 995 kişi gösteriliyor');
  assert.equal(describeRosterCoverage(100, 100), '100 / 100 kişi gösteriliyor');
});

// --- mergeRosterPage ---

test('mergeRosterPage: bos + bos -> bos', () => {
  assert.deepEqual(mergeRosterPage([], []), []);
});

test('mergeRosterPage: ikinci sayfa ekleme (birlestirme)', () => {
  const existing = [{ id: 'a' }, { id: 'b' }];
  const incoming = [{ id: 'c' }, { id: 'd' }];
  assert.deepEqual(mergeRosterPage(existing, incoming), [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
  ]);
});

test('mergeRosterPage: duplicate katilimci dedup edilir', () => {
  const existing = [{ id: 'a' }, { id: 'b' }];
  const incoming = [{ id: 'b' }, { id: 'c' }];
  assert.deepEqual(mergeRosterPage(existing, incoming), [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
  ]);
});

test('mergeRosterPage: sayfalar sira-disi gelse bile dedup calisir', () => {
  const existing = [{ id: 'c' }, { id: 'd' }];
  const incoming = [{ id: 'a' }, { id: 'c' }];
  assert.deepEqual(mergeRosterPage(existing, incoming), [
    { id: 'c' },
    { id: 'd' },
    { id: 'a' },
  ]);
});

test('mergeRosterPage: basarisiz sonraki sayfa (bos incoming) mevcut listeyi korur', () => {
  const existing = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(mergeRosterPage(existing, []), existing);
});
