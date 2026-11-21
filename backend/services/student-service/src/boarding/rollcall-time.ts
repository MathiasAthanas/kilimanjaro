import { RollCallSession } from '../../generated/prisma';

/** School time is East Africa Time (UTC+3, no daylight saving). */
const EAT_OFFSET_HOURS = 3;

export type RollCallDeadlines = { MORNING: string; EVENING: string };

export function deadlinesFromEnv(env: Record<string, string | undefined>): RollCallDeadlines {
  const ok = (value: string | undefined, fallback: string) => (value && /^\d{1,2}:\d{2}$/.test(value.trim()) ? value.trim() : fallback);
  return { MORNING: ok(env.ROLLCALL_MORNING_DEADLINE, '08:00'), EVENING: ok(env.ROLLCALL_EVENING_DEADLINE, '21:00') };
}

/** Minutes since midnight, school time. */
export function minutesEat(now: Date = new Date()): number {
  const eat = new Date(now.getTime() + EAT_OFFSET_HOURS * 3600 * 1000);
  return eat.getUTCHours() * 60 + eat.getUTCMinutes();
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * The date roll calls are stored under. The dashboard and the record endpoint both use the UTC calendar date, so the
 * monitor and the report must use the same one.
 */
export function rollCallDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Sessions whose deadline has already passed at this moment of the school day. */
export function sessionsDue(now: Date, deadlines: RollCallDeadlines): RollCallSession[] {
  const minutes = minutesEat(now);
  const due: RollCallSession[] = [];
  if (minutes >= minutesOf(deadlines.MORNING)) due.push(RollCallSession.MORNING);
  if (minutes >= minutesOf(deadlines.EVENING)) due.push(RollCallSession.EVENING);
  return due;
}

export function isSessionDue(session: RollCallSession, now: Date, deadlines: RollCallDeadlines): boolean {
  return sessionsDue(now, deadlines).includes(session);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  for (let t = new Date(`${from}T00:00:00.000Z`).getTime(); t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
