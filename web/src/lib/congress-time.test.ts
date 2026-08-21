import test from 'node:test';
import assert from 'node:assert/strict';
import {
  datetimeLocalToIso,
  datetimeLocalToIsoOrUndefined,
  formatIstanbulDateTime,
  formatIstanbulDateTimeWithYear,
  formatIstanbulDateTimeWithSeconds,
  formatIstanbulTime,
  isoToDatetimeLocal,
  formatDateOnly,
} from './congress-time.ts';

// Faz 12: bu testler `process.env.TZ`den BAGIMSIZ ayni sonucu vermelidir -
// asil kanit bu (bkz. docs/decisions.md "Faz 12" - eski hatada testler
// yereldeki tarayici/sunucu saatine bagimliydi ve hicbir zaman diliminde
// yakalanamiyordu).

test('datetimeLocalToIso: "15:00 Turkiye saati" -> dogru UTC uretir', () => {
  assert.equal(datetimeLocalToIso('2026-09-01T15:00'), '2026-09-01T12:00:00.000Z');
});

test('datetimeLocalToIso: gece yarisini dogru gecer', () => {
  assert.equal(datetimeLocalToIso('2026-09-10T00:00'), '2026-09-09T21:00:00.000Z');
});

test('datetimeLocalToIsoOrUndefined: bos deger undefined doner', () => {
  assert.equal(datetimeLocalToIsoOrUndefined(''), undefined);
  assert.equal(datetimeLocalToIsoOrUndefined(null), undefined);
  assert.equal(datetimeLocalToIsoOrUndefined('   '), undefined);
});

test('datetimeLocalToIsoOrUndefined: dolu deger datetimeLocalToIso ile ayni sonucu verir', () => {
  assert.equal(
    datetimeLocalToIsoOrUndefined('2026-09-01T15:00'),
    '2026-09-01T12:00:00.000Z',
  );
});

test('isoToDatetimeLocal: datetimeLocalToIso ile round-trip', () => {
  const original = '2026-09-01T15:00';
  const iso = datetimeLocalToIso(original);
  assert.equal(isoToDatetimeLocal(iso), original);
});

test('isoToDatetimeLocal: bos/null girdide bos string doner', () => {
  assert.equal(isoToDatetimeLocal(null), '');
});

test('formatIstanbulDateTime: UTC 12:00 -> Turkiye saatinde 15:00 gosterir', () => {
  assert.equal(formatIstanbulDateTime('2026-09-01T12:00:00.000Z'), '01/09 15:00');
});

test('formatIstanbulTime: UTC 12:00 -> Turkiye saatinde 15:00 gosterir', () => {
  assert.equal(formatIstanbulTime('2026-09-01T12:00:00.000Z'), '15:00');
});

test('formatIstanbulDateTimeWithYear: UTC 12:00 -> Turkiye saatinde yil ile gosterir', () => {
  assert.equal(formatIstanbulDateTimeWithYear('2026-09-01T12:00:00.000Z'), '01.09.2026 15:00');
});

test('formatIstanbulDateTimeWithSeconds: UTC 12:00:30 -> Turkiye saatinde saniyeli gosterir', () => {
  assert.equal(formatIstanbulDateTimeWithSeconds('2026-09-01T12:00:30.000Z'), '01/09 15:00:30');
});

test('formatIstanbulDateTime/formatIstanbulTime: null girdide tire doner', () => {
  assert.equal(formatIstanbulDateTime(null), '—');
  assert.equal(formatIstanbulTime(null), '—');
});

test('formatDateOnly: saat dilimi donusumune GIRMEDEN ilk 10 karakteri kullanir', () => {
  // Bilincli olarak: '2026-07-23T00:00:00.000Z' -> Turkiye saatine
  // cevrilseydi 23 Temmuz 03:00 olurdu (GUN KAYMAZ, ama bu fonksiyon
  // zaten donusume hic girmiyor) - istisnanin kanitlandigi test budur.
  assert.equal(formatDateOnly('2026-07-23T00:00:00.000Z'), '23.07.2026');
  assert.equal(formatDateOnly(null), '—');
});
