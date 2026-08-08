import { pickNextSession, NextSessionCandidate } from './my-next-session';
import { ProgramRoleType } from '../../generated/prisma/client';

const NOW = new Date('2026-04-09T12:00:00.000Z');

function candidate(
  overrides: Partial<NextSessionCandidate>,
): NextSessionCandidate {
  return {
    sessionId: 's1',
    presentationId: null,
    title: 'Oturum',
    hallName: 'Salon 1',
    startTime: new Date('2026-04-09T13:00:00.000Z'),
    endTime: new Date('2026-04-09T14:00:00.000Z'),
    roleType: ProgramRoleType.MODERATOR,
    ...overrides,
  };
}

describe('pickNextSession', () => {
  it('hic aday yoksa null doner', () => {
    expect(pickNextSession([], NOW)).toBeNull();
  });

  it('yalnizca GECMIS adaylar varsa null doner', () => {
    const past = candidate({
      startTime: new Date('2026-04-09T09:00:00.000Z'),
      endTime: new Date('2026-04-09T10:00:00.000Z'),
    });
    expect(pickNextSession([past], NOW)).toBeNull();
  });

  it('SUREGELEN bir aday varsa onu isOngoing:true ile doner', () => {
    const ongoing = candidate({
      sessionId: 'ongoing',
      startTime: new Date('2026-04-09T11:30:00.000Z'),
      endTime: new Date('2026-04-09T12:30:00.000Z'),
    });
    const result = pickNextSession([ongoing], NOW);
    expect(result).toMatchObject({ sessionId: 'ongoing', isOngoing: true });
  });

  it('GELECEKteki en yakin adayi isOngoing:false ile doner', () => {
    const soon = candidate({
      sessionId: 'soon',
      startTime: new Date('2026-04-09T13:00:00.000Z'),
      endTime: new Date('2026-04-09T14:00:00.000Z'),
    });
    const later = candidate({
      sessionId: 'later',
      startTime: new Date('2026-04-09T16:00:00.000Z'),
      endTime: new Date('2026-04-09T17:00:00.000Z'),
    });
    const result = pickNextSession([later, soon], NOW);
    expect(result).toMatchObject({ sessionId: 'soon', isOngoing: false });
  });

  it('suregelen bir aday varken gelecekteki adaylari ONCELER', () => {
    const ongoing = candidate({
      sessionId: 'ongoing',
      startTime: new Date('2026-04-09T11:30:00.000Z'),
      endTime: new Date('2026-04-09T12:30:00.000Z'),
    });
    const future = candidate({
      sessionId: 'future',
      startTime: new Date('2026-04-09T13:00:00.000Z'),
      endTime: new Date('2026-04-09T14:00:00.000Z'),
    });
    const result = pickNextSession([future, ongoing], NOW);
    expect(result).toMatchObject({ sessionId: 'ongoing', isOngoing: true });
  });

  it('birden fazla suregelen aday varsa en erken baslayan secilir', () => {
    const a = candidate({
      sessionId: 'a',
      startTime: new Date('2026-04-09T11:00:00.000Z'),
      endTime: new Date('2026-04-09T13:00:00.000Z'),
    });
    const b = candidate({
      sessionId: 'b',
      startTime: new Date('2026-04-09T11:30:00.000Z'),
      endTime: new Date('2026-04-09T13:00:00.000Z'),
    });
    const result = pickNextSession([b, a], NOW);
    expect(result).toMatchObject({ sessionId: 'a', isOngoing: true });
  });

  it('sinir durumu: now === startTime -> suregelen sayilir (dahil)', () => {
    const startsNow = candidate({
      sessionId: 'starts-now',
      startTime: NOW,
      endTime: new Date('2026-04-09T13:00:00.000Z'),
    });
    const result = pickNextSession([startsNow], NOW);
    expect(result).toMatchObject({ sessionId: 'starts-now', isOngoing: true });
  });

  it('sinir durumu: now === endTime -> suregelen sayilir (dahil)', () => {
    const endsNow = candidate({
      sessionId: 'ends-now',
      startTime: new Date('2026-04-09T11:00:00.000Z'),
      endTime: NOW,
    });
    const result = pickNextSession([endsNow], NOW);
    expect(result).toMatchObject({ sessionId: 'ends-now', isOngoing: true });
  });

  it('gecmis + suregelen + gelecek karisik listede dogru olani secer', () => {
    const past = candidate({
      sessionId: 'past',
      startTime: new Date('2026-04-09T08:00:00.000Z'),
      endTime: new Date('2026-04-09T09:00:00.000Z'),
    });
    const ongoing = candidate({
      sessionId: 'ongoing',
      startTime: new Date('2026-04-09T11:30:00.000Z'),
      endTime: new Date('2026-04-09T12:30:00.000Z'),
    });
    const future = candidate({
      sessionId: 'future',
      startTime: new Date('2026-04-09T15:00:00.000Z'),
      endTime: new Date('2026-04-09T16:00:00.000Z'),
    });
    const result = pickNextSession([future, past, ongoing], NOW);
    expect(result).toMatchObject({ sessionId: 'ongoing', isOngoing: true });
  });
});
