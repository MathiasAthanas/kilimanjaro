import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { RollCallSession } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { BoardingService } from './boarding.service';
import { RollCallNotifierService } from './rollcall-notifier.service';
import { dateRange, deadlinesFromEnv, isSessionDue, rollCallDate, RollCallDeadlines, sessionsDue } from './rollcall-time';

const SESSIONS: RollCallSession[] = [RollCallSession.MORNING, RollCallSession.EVENING];
const DAY_MS = 86400000;
const sessionName = (s: RollCallSession) => (s === RollCallSession.MORNING ? 'Morning' : 'Evening');
const person = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`.trim();

export type SessionStatus = 'DONE' | 'MISSING' | 'NOT_DUE';

@Injectable()
export class RollCallReportService {
  private readonly logger = new Logger(RollCallReportService.name);
  private readonly deadlines: RollCallDeadlines;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly boarding: BoardingService,
    private readonly notifier: RollCallNotifierService,
    config: ConfigService,
  ) {
    this.deadlines = deadlinesFromEnv({ ROLLCALL_MORNING_DEADLINE: config.get<string>('ROLLCALL_MORNING_DEADLINE'), ROLLCALL_EVENING_DEADLINE: config.get<string>('ROLLCALL_EVENING_DEADLINE') });
  }

  // ── Report and analytics ─────────────────────────────────────────────────────────

  /** Today's roll calls per dormitory and session, plus a trend, per-dormitory rates and the most absent students. */
  async report(user: RequestUser | undefined, daysInput = 14) {
    const days = Math.min(90, Math.max(1, Math.floor(Number(daysInput) || 14)));
    const now = new Date();
    const today = rollCallDate(now);
    const from = new Date(new Date(`${today}T00:00:00.000Z`).getTime() - (days - 1) * DAY_MS).toISOString().slice(0, 10);
    const dorms = await this.boarding.listDormitories(user);
    const ids = dorms.map((d) => d.id);
    if (!ids.length) {
      return { today, deadlines: this.deadlines, range: { from, to: today, days }, sessionsToday: [], absentToday: [], trend: [], dormitories: [], topAbsent: [], totals: { dormitories: 0, missingNow: 0, absentToday: 0, completionRate: null, presentRate: null } };
    }

    const [rows, rosters] = await Promise.all([
      this.prisma.hostelRollCall.findMany({
        where: { dormitoryId: { in: ids }, date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${today}T00:00:00.000Z`) } },
        select: { dormitoryId: true, studentId: true, date: true, session: true, status: true, note: true },
      }),
      this.prisma.dormitoryStudentAssignment.groupBy({ by: ['dormitoryId'], where: { dormitoryId: { in: ids }, isActive: true }, _count: { _all: true } }),
    ]);
    const roster = new Map(rosters.map((r) => [r.dormitoryId, r._count._all]));
    const dateOf = (d: Date) => d.toISOString().slice(0, 10);
    // A dormitory is only expected to have done roll calls from the day it was set up.
    const startedOn = new Map(dorms.map((d) => [d.id, dateOf(new Date((d as { createdAt?: Date | string }).createdAt ?? from))]));

    type Cell = { total: number; present: number; absent: number; onLeave: number; excused: number };
    const cells = new Map<string, Cell>();
    const cellKey = (dorm: string, date: string, session: string) => `${dorm}|${date}|${session}`;
    for (const r of rows) {
      const key = cellKey(r.dormitoryId, dateOf(r.date), r.session);
      const c = cells.get(key) ?? { total: 0, present: 0, absent: 0, onLeave: 0, excused: 0 };
      c.total++;
      if (r.status === 'PRESENT') c.present++;
      else if (r.status === 'ABSENT') c.absent++;
      else if (r.status === 'ON_LEAVE') c.onLeave++;
      else if (r.status === 'EXCUSED') c.excused++;
      cells.set(key, c);
    }

    // today, per session and dormitory
    const absentRows = rows.filter((r) => dateOf(r.date) === today && r.status === 'ABSENT');
    const absentIds = [...new Set(rows.filter((r) => r.status === 'ABSENT').map((r) => r.studentId))];
    const students = absentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: absentIds } },
          select: { id: true, firstName: true, lastName: true, registrationNumber: true, enrolments: { where: { isActive: true }, take: 1, select: { class: { select: { name: true } } } } },
        })
      : [];
    const studentById = new Map(students.map((s) => [s.id, s]));
    const dormName = new Map(dorms.map((d) => [d.id, d.name]));

    const sessionsToday = SESSIONS.map((session) => {
      const due = isSessionDue(session, now, this.deadlines);
      const list = dorms.map((d) => {
        const c = cells.get(cellKey(d.id, today, session));
        const status: SessionStatus = c ? 'DONE' : due ? 'MISSING' : 'NOT_DUE';
        return { dormitoryId: d.id, dormitory: d.name, rosterSize: roster.get(d.id) ?? 0, status, ...(c ?? { total: 0, present: 0, absent: 0, onLeave: 0, excused: 0 }) };
      });
      return { session, deadline: this.deadlines[session], due, dormitories: list };
    });

    const absentToday = absentRows.map((r) => {
      const s = studentById.get(r.studentId);
      return { studentId: r.studentId, name: s ? person(s) : 'Student', registrationNumber: s?.registrationNumber ?? '', className: s?.enrolments[0]?.class?.name ?? null, dormitory: dormName.get(r.dormitoryId) ?? '', session: r.session, note: r.note ?? null };
    });

    // trend per day
    const trend = dateRange(from, today).map((date) => {
      let total = 0, present = 0, absent = 0, recorded = 0, expected = 0;
      for (const d of dorms) {
        if (!(roster.get(d.id) ?? 0) || date < (startedOn.get(d.id) ?? from)) continue;
        for (const session of SESSIONS) {
          const due = date < today || (date === today && isSessionDue(session, now, this.deadlines));
          if (due) expected++;
          const c = cells.get(cellKey(d.id, date, session));
          if (c) { recorded++; total += c.total; present += c.present; absent += c.absent; }
        }
      }
      return { date, total, present, absent, recorded, expected, presentRate: total ? Math.round((present / total) * 1000) / 10 : null };
    });

    // per dormitory over the range
    const perDorm = dorms.map((d) => {
      let total = 0, present = 0, absent = 0, recorded = 0, expected = 0;
      for (const date of dateRange(from, today)) {
        for (const session of SESSIONS) {
          if (!(roster.get(d.id) ?? 0) || date < (startedOn.get(d.id) ?? from)) continue;
          const due = date < today || (date === today && isSessionDue(session, now, this.deadlines));
          if (due) expected++;
          const c = cells.get(cellKey(d.id, date, session));
          if (c) { recorded++; total += c.total; present += c.present; absent += c.absent; }
        }
      }
      return {
        dormitoryId: d.id, name: d.name, rosterSize: roster.get(d.id) ?? 0, recorded, expected, absent,
        completionRate: expected ? Math.round((recorded / expected) * 1000) / 10 : null,
        presentRate: total ? Math.round((present / total) * 1000) / 10 : null,
      };
    });

    // most absent students
    const absences = new Map<string, number>();
    for (const r of rows) if (r.status === 'ABSENT') absences.set(r.studentId, (absences.get(r.studentId) ?? 0) + 1);
    const topAbsent = [...absences.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([studentId, count]) => {
      const s = studentById.get(studentId);
      return { studentId, name: s ? person(s) : 'Student', registrationNumber: s?.registrationNumber ?? '', className: s?.enrolments[0]?.class?.name ?? null, absences: count };
    });

    const missingNow = sessionsToday.reduce((n, s) => n + s.dormitories.filter((d) => d.status === 'MISSING' && d.rosterSize > 0).length, 0);
    const totalsExpected = trend.reduce((n, t) => n + t.expected, 0);
    const totalsRecorded = trend.reduce((n, t) => n + t.recorded, 0);
    const totalPeople = trend.reduce((n, t) => n + t.total, 0);
    const totalPresent = trend.reduce((n, t) => n + t.present, 0);
    return {
      today,
      deadlines: this.deadlines,
      range: { from, to: today, days },
      sessionsToday,
      absentToday,
      trend,
      dormitories: perDorm,
      topAbsent,
      totals: {
        dormitories: dorms.length,
        missingNow,
        absentToday: absentToday.length,
        completionRate: totalsExpected ? Math.round((totalsRecorded / totalsExpected) * 1000) / 10 : null,
        presentRate: totalPeople ? Math.round((totalPresent / totalPeople) * 1000) / 10 : null,
      },
    };
  }

  // ── Alerts and the daily summary ─────────────────────────────────────────────────

  private async once(key: string, ttlSeconds = 36 * 3600): Promise<boolean> {
    try {
      if (await this.redis.get(key)) return false;
      await this.redis.set(key, 1, ttlSeconds);
    } catch {
      // without Redis the notification service still de-duplicates identical messages for a day
    }
    return true;
  }

  /** Dormitories with students whose roll call for a due session is still missing, grouped by school. */
  private async overdue(now: Date) {
    const today = rollCallDate(now);
    const due = sessionsDue(now, this.deadlines);
    const found: Array<{ schoolId: string; session: RollCallSession; dormitoryId: string; name: string }> = [];
    if (!due.length) return { today, due, found };
    const dorms = await this.prisma.dormitory.findMany({
      where: { isActive: true, studentAssignments: { some: { isActive: true } } },
      select: { id: true, schoolId: true, name: true },
    });
    if (!dorms.length) return { today, due, found };
    const done = await this.prisma.hostelRollCall.findMany({
      where: { dormitoryId: { in: dorms.map((d) => d.id) }, date: new Date(`${today}T00:00:00.000Z`), session: { in: due } },
      distinct: ['dormitoryId', 'session'],
      select: { dormitoryId: true, session: true },
    });
    const have = new Set(done.map((r) => `${r.dormitoryId}|${r.session}`));
    for (const session of due) for (const d of dorms) if (!have.has(`${d.id}|${session}`)) found.push({ schoolId: d.schoolId, session, dormitoryId: d.id, name: d.name });
    return { today, due, found };
  }

  /** Tell the leadership of each school which roll calls are overdue. Each dormitory and session is reported once a day. */
  async alertOverdue(now: Date = new Date(), dryRun = false) {
    const { today, found } = await this.overdue(now);
    const bySchoolSession = new Map<string, typeof found>();
    for (const f of found) {
      const k = `${f.schoolId}|${f.session}`;
      bySchoolSession.set(k, [...(bySchoolSession.get(k) ?? []), f]);
    }
    const sent: Array<{ schoolId: string; session: string; dormitories: string[]; notified: number }> = [];
    for (const [k, list] of bySchoolSession) {
      const [schoolId, session] = k.split('|') as [string, RollCallSession];
      const fresh: typeof list = [];
      for (const f of list) if (dryRun || (await this.once(`rollcall:alert:${f.dormitoryId}:${today}:${session}`))) fresh.push(f);
      if (!fresh.length) continue;
      const names = fresh.map((f) => f.name);
      let notified = 0;
      if (!dryRun) {
        notified = await this.notifier.notifyLeaders(
          schoolId,
          `${sessionName(session)} roll call not done`,
          `The ${sessionName(session).toLowerCase()} roll call (due ${this.deadlines[session]}) has not been recorded for: ${names.join(', ')}. Please follow up with the matron or patron.`,
          `rollcall-alert:${schoolId}:${today}:${session}:${fresh.map((f) => f.dormitoryId).sort().join(',')}`,
        );
      }
      sent.push({ schoolId, session, dormitories: names, notified });
    }
    return { date: today, alerts: sent };
  }

  /** One message per school at night: who was absent today and which roll calls were never done. */
  async sendDailySummary(now: Date = new Date(), dryRun = false) {
    const today = rollCallDate(now);
    const dorms = await this.prisma.dormitory.findMany({ where: { isActive: true, studentAssignments: { some: { isActive: true } } }, select: { id: true, schoolId: true, name: true } });
    const schools = [...new Set(dorms.map((d) => d.schoolId))];
    const results: Array<{ schoolId: string; absent: number; missing: number; notified: number; text: string }> = [];
    for (const schoolId of schools) {
      const ids = dorms.filter((d) => d.schoolId === schoolId).map((d) => d.id);
      const rows = await this.prisma.hostelRollCall.findMany({
        where: { dormitoryId: { in: ids }, date: new Date(`${today}T00:00:00.000Z`) },
        select: { dormitoryId: true, session: true, status: true, studentId: true },
      });
      const absentIds = [...new Set(rows.filter((r) => r.status === 'ABSENT').map((r) => r.studentId))];
      const students = absentIds.length ? await this.prisma.student.findMany({ where: { id: { in: absentIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
      const recorded = new Set(rows.map((r) => `${r.dormitoryId}|${r.session}`));
      const missing: string[] = [];
      for (const d of dorms.filter((x) => x.schoolId === schoolId)) for (const s of SESSIONS) if (!recorded.has(`${d.id}|${s}`)) missing.push(`${d.name} (${sessionName(s).toLowerCase()})`);
      const lines = [
        absentIds.length ? `Absent today (${absentIds.length}): ${students.map(person).slice(0, 15).join(', ')}${absentIds.length > 15 ? ` and ${absentIds.length - 15} more` : ''}.` : 'No student was marked absent today.',
        missing.length ? `Roll calls not done: ${missing.join(', ')}.` : 'All roll calls were done.',
      ];
      const text = lines.join(' ');
      let notified = 0;
      if (!dryRun && (await this.once(`rollcall:summary:${schoolId}:${today}`))) {
        notified = await this.notifier.notifyLeaders(schoolId, `Hostel roll call summary, ${today}`, text, `rollcall-summary:${schoolId}:${today}`);
      }
      results.push({ schoolId, absent: absentIds.length, missing: missing.length, notified, text });
    }
    return { date: today, summaries: results };
  }

  @Cron('0 */10 * * * *', { timeZone: 'Africa/Dar_es_Salaam' })
  async scheduledAlerts() {
    try {
      const result = await this.alertOverdue();
      if (result.alerts.length) this.logger.log(`Roll-call alerts sent: ${JSON.stringify(result.alerts)}`);
    } catch (err) {
      this.logger.warn(`Roll-call alert run failed: ${(err as Error)?.message}`);
    }
  }

  @Cron('0 30 21 * * *', { timeZone: 'Africa/Dar_es_Salaam' })
  async scheduledSummary() {
    try {
      await this.sendDailySummary();
    } catch (err) {
      this.logger.warn(`Roll-call summary failed: ${(err as Error)?.message}`);
    }
  }
}
