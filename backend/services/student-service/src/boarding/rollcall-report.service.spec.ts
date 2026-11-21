import { RollCallSession } from '../../generated/prisma';
import { dateRange, deadlinesFromEnv, minutesEat, rollCallDate, sessionsDue } from './rollcall-time';
import { RollCallReportService } from './rollcall-report.service';

const deadlines = deadlinesFromEnv({});

describe('roll call time', () => {
  it('works in school time (UTC+3)', () => {
    expect(minutesEat(new Date('2026-11-21T05:00:00Z'))).toBe(8 * 60);
    expect(rollCallDate(new Date('2026-11-21T05:00:00Z'))).toBe('2026-11-21');
  });

  it('knows which sessions are due', () => {
    expect(sessionsDue(new Date('2026-11-21T04:30:00Z'), deadlines)).toEqual([]); // 07:30
    expect(sessionsDue(new Date('2026-11-21T05:01:00Z'), deadlines)).toEqual([RollCallSession.MORNING]); // 08:01
    expect(sessionsDue(new Date('2026-11-21T18:05:00Z'), deadlines)).toEqual([RollCallSession.MORNING, RollCallSession.EVENING]); // 21:05
  });

  it('reads custom deadlines and ignores bad ones', () => {
    expect(deadlinesFromEnv({ ROLLCALL_MORNING_DEADLINE: '07:15', ROLLCALL_EVENING_DEADLINE: 'late' })).toEqual({ MORNING: '07:15', EVENING: '21:00' });
  });

  it('lists every day in a range', () => {
    expect(dateRange('2026-11-19', '2026-11-21')).toEqual(['2026-11-19', '2026-11-20', '2026-11-21']);
  });
});

describe('RollCallReportService overdue alerts', () => {
  function build(done: Array<{ dormitoryId: string; session: RollCallSession }>) {
    const prisma = {
      dormitory: { findMany: jest.fn().mockResolvedValue([{ id: 'd1', schoolId: 's1', name: 'Kibo Hall' }, { id: 'd2', schoolId: 's1', name: 'Mawenzi House' }]) },
      hostelRollCall: { findMany: jest.fn().mockResolvedValue(done) },
    };
    const store = new Map<string, unknown>();
    const redis = { get: jest.fn(async (k: string) => store.get(k) ?? null), set: jest.fn(async (k: string, v: unknown) => { store.set(k, v); }) };
    const notifier = { notifyLeaders: jest.fn().mockResolvedValue(3) };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const service = new RollCallReportService(prisma as any, redis as any, {} as any, notifier as any, config as any);
    return { service, notifier, prisma };
  }

  const afterMorningDeadline = new Date('2026-11-21T05:30:00Z'); // 08:30 school time

  it('alerts the leaders about the dormitory that has not recorded', async () => {
    const { service, notifier } = build([{ dormitoryId: 'd1', session: RollCallSession.MORNING }]);
    const result = await service.alertOverdue(afterMorningDeadline);
    expect(result.alerts).toEqual([{ schoolId: 's1', session: 'MORNING', dormitories: ['Mawenzi House'], notified: 3 }]);
    expect(notifier.notifyLeaders).toHaveBeenCalledWith('s1', 'Morning roll call not done', expect.stringContaining('Mawenzi House'), expect.any(String));
  });

  it('does not repeat the same alert', async () => {
    const { service, notifier } = build([]);
    await service.alertOverdue(afterMorningDeadline);
    const second = await service.alertOverdue(afterMorningDeadline);
    expect(second.alerts).toEqual([]);
    expect(notifier.notifyLeaders).toHaveBeenCalledTimes(1);
  });

  it('stays quiet before the deadline and when everything was recorded', async () => {
    const early = build([]);
    expect((await early.service.alertOverdue(new Date('2026-11-21T04:00:00Z'))).alerts).toEqual([]);
    const complete = build([{ dormitoryId: 'd1', session: RollCallSession.MORNING }, { dormitoryId: 'd2', session: RollCallSession.MORNING }]);
    expect((await complete.service.alertOverdue(afterMorningDeadline)).alerts).toEqual([]);
  });

  it('a dry run shows what would be sent without sending', async () => {
    const { service, notifier } = build([]);
    const result = await service.alertOverdue(afterMorningDeadline, true);
    expect(result.alerts[0].dormitories).toEqual(['Kibo Hall', 'Mawenzi House']);
    expect(notifier.notifyLeaders).not.toHaveBeenCalled();
  });
});
