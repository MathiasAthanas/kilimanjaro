import { Activity, BookOpenCheck, CalendarDays, CircleDollarSign, GraduationCap, Home, ShieldCheck, Users } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge } from '../../../components/common/Badge';

// External service payloads are intentionally additive and differ by role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

type Props = {
  student: Row;
  attendance: Row | null;
  performance: Row[];
  finance: Row | null;
  discipline: Row[];
  guardians: Row[];
};

const dateLabel = (value: unknown) => {
  if (!value) return 'Date not recorded';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const money = (value: unknown) => `TSh ${Number(value ?? 0).toLocaleString()}`;

const scoreOf = (row: Row) => {
  const value = Number(row.score ?? row.marks ?? row.currentScore ?? row.averageScore);
  return Number.isFinite(value) ? value : null;
};

const yearLabel = (enrolment: Row) => String(enrolment.academicYear?.name ?? enrolment.academicYear?.year ?? 'Year not recorded');

export function StudentLifecyclePanel({ student, attendance, performance, finance, discipline, guardians }: Props) {
  const enrolments = (Array.isArray(student.enrolments) ? student.enrolments : [])
    .slice()
    .sort((a: Row, b: Row) => new Date(a.academicYear?.startDate ?? a.enrolledAt ?? 0).getTime() - new Date(b.academicYear?.startDate ?? b.enrolledAt ?? 0).getTime());
  const residenceChanges = Array.isArray(student.residenceChanges) ? student.residenceChanges : [];
  const dormitoryAssignments = Array.isArray(student.dormitoryAssignments) ? student.dormitoryAssignments : [];
  const invoices = Array.isArray(finance?.invoices) ? finance.invoices : [];

  const performanceByPeriod = new Map<string, { total: number; count: number }>();
  performance.forEach((record) => {
    const year = record.academicYear?.name ?? record.academicYear?.year;
    const term = record.term?.name ?? record.termName ?? record.term;
    const period = [year, term].filter(Boolean).join(' · ') || 'Current';
    const score = scoreOf(record);
    if (score == null) return;
    const current = performanceByPeriod.get(period) ?? { total: 0, count: 0 };
    performanceByPeriod.set(period, { total: current.total + score, count: current.count + 1 });
  });
  const academicChart = Array.from(performanceByPeriod, ([period, value]) => ({ period, average: Number((value.total / value.count).toFixed(1)) }));
  const subjectMap = new Map<string, { total: number; count: number; latestScore: number; grade: string }>();
  performance.forEach((record) => {
    const subject = String(record.subjectName ?? record.subject ?? 'Subject');
    const score = scoreOf(record);
    if (score == null) return;
    const current = subjectMap.get(subject) ?? { total: 0, count: 0, latestScore: score, grade: '—' };
    subjectMap.set(subject, {
      total: current.total + score,
      count: current.count + 1,
      latestScore: score,
      grade: String(record.grade ?? current.grade),
    });
  });
  const subjectSummary = Array.from(subjectMap, ([subject, value]) => ({
    subject,
    average: value.total / value.count,
    latestScore: value.latestScore,
    grade: value.grade,
    records: value.count,
  })).sort((a, b) => b.average - a.average);

  const financeChart = invoices
    .slice()
    .sort((a: Row, b: Row) => new Date(a.createdAt ?? a.dueDate ?? 0).getTime() - new Date(b.createdAt ?? b.dueDate ?? 0).getTime())
    .map((invoice: Row) => ({
      period: String(invoice.termName ?? invoice.term?.name ?? invoice.invoiceNumber ?? 'Invoice'),
      invoiced: Number(invoice.totalAmount ?? 0),
      paid: Number(invoice.paidAmount ?? 0),
      balance: Number(invoice.outstandingBalance ?? 0),
    }));

  const scores = performance.map(scoreOf).filter((value): value is number => value != null);
  const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
  const attendanceRate = Number(attendance?.rate ?? attendance?.attendanceRate);
  const admission = student.admissionDate ?? student.createdAt;
  const exitDate = student.graduationDate ?? student.transferDate;
  const yearsAtSchool = admission
    ? Math.max(0, Math.floor((new Date(exitDate ?? Date.now()).getTime() - new Date(admission).getTime()) / 31_556_952_000))
    : null;

  const timeline = [
    admission ? { date: admission, title: 'Joined the school', detail: `Admission record created as ${student.registrationNumber ?? student.registration ?? 'a registered student'}`, tone: 'indigo' } : null,
    ...enrolments.map((enrolment: Row) => ({
      date: enrolment.promotedFrom ? (enrolment.promotedAt ?? enrolment.enrolledAt) : enrolment.enrolledAt,
      title: `${enrolment.promotedFrom ? 'Promoted to' : enrolment.isActive ? 'Current class' : 'Enrolled in'} · ${enrolment.class?.name ?? 'Class'}`,
      detail: `${yearLabel(enrolment)}${enrolment.class?.stream ? ` · ${enrolment.class.stream}` : ''}${enrolment.term?.name ? ` · ${enrolment.term.name}` : ''}`,
      tone: enrolment.isActive ? 'emerald' : 'blue',
    })),
    ...residenceChanges.map((change: Row) => ({
      date: change.appliedAt ?? change.createdAt,
      title: 'Residence classification updated',
      detail: `${change.fromType ? String(change.fromType).replace('_', ' ') : 'Not classified'} → ${String(change.toType ?? '').replace('_', ' ')}`,
      tone: 'amber',
    })),
    ...dormitoryAssignments.map((assignment: Row) => ({
      date: assignment.assignedAt,
      title: `${assignment.isActive ? 'Current hostel assignment' : 'Hostel assignment'} · ${assignment.dormitory?.name ?? 'Dormitory'}`,
      detail: (assignment.bed?.label ?? assignment.bed?.number ?? assignment.bedId)
        ? `Bed ${assignment.bed?.label ?? assignment.bed?.number ?? assignment.bedId}`
        : 'No bed number recorded',
      tone: 'violet',
    })),
    ...discipline.map((record: Row) => ({
      date: record.incidentDate ?? record.date ?? record.createdAt,
      title: `Discipline · ${record.category ?? record.severity ?? 'Incident'}`,
      detail: record.description ?? record.incident ?? record.actionTaken ?? 'Record added',
      tone: 'rose',
    })),
    ...invoices.map((invoice: Row) => ({
      date: invoice.issuedAt ?? invoice.createdAt,
      title: `Invoice issued · ${invoice.invoiceNumber ?? 'School fees'}`,
      detail: `${money(invoice.totalAmount)} · ${String(invoice.status ?? 'DRAFT').replaceAll('_', ' ')}`,
      tone: 'amber',
    })),
    ...(Array.isArray(finance?.payments) ? finance.payments : []).map((payment: Row) => ({
      date: payment.paidAt ?? payment.confirmedAt ?? payment.createdAt,
      title: `Payment recorded · ${payment.paymentNumber ?? payment.invoiceNumber ?? 'School fees'}`,
      detail: `${money(payment.amount)} · ${String(payment.status ?? payment.method ?? 'RECORDED').replaceAll('_', ' ')}`,
      tone: 'emerald',
    })),
    exitDate ? { date: exitDate, title: student.status === 'GRADUATED' ? 'Graduated' : 'Left the school', detail: student.transferSchool ? `Transferred to ${student.transferSchool}` : String(student.status ?? 'Student lifecycle closed'), tone: 'slate' } : null,
  ].filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()) as Array<Row>;

  const currentClass = enrolments.find((row: Row) => row.isActive)?.class?.name ?? student.className ?? 'Not assigned';
  const residence = student.residenceType === 'BOARDING' ? 'Boarding' : student.residenceType === 'DAY_SCHOLAR' ? 'Day Scholar' : 'Not classified';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#4338CA]">Complete student journey</p>
        <h3 className="mt-1 font-display text-xl font-black text-ks-navy">From admission to {exitDate ? 'departure' : 'today'}</h3>
        <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">A read-only summary of the student’s yearly classes, academic progress, attendance, finance, welfare and key school events.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={GraduationCap} label="Current class" value={currentClass} detail={`${enrolments.length} recorded class year${enrolments.length === 1 ? '' : 's'}`} />
        <Metric icon={CalendarDays} label="Time at school" value={yearsAtSchool == null ? '—' : `${yearsAtSchool} year${yearsAtSchool === 1 ? '' : 's'}`} detail={`Admitted ${dateLabel(admission)}`} />
        <Metric icon={Activity} label="Attendance" value={Number.isFinite(attendanceRate) ? `${attendanceRate.toFixed(1)}%` : '—'} detail={`${attendance?.present ?? 0} present · ${attendance?.absent ?? 0} absent`} />
        <Metric icon={BookOpenCheck} label="Academic average" value={averageScore == null ? '—' : `${averageScore.toFixed(1)}%`} detail={`${scores.length} scored subject record${scores.length === 1 ? '' : 's'}`} />
        <Metric icon={CircleDollarSign} label="Total invoiced" value={money(finance?.totalInvoiced)} detail={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`} />
        <Metric icon={ShieldCheck} label="Paid / balance" value={money(finance?.totalPaid)} detail={`${money(finance?.balance)} outstanding`} />
        <Metric icon={Home} label="Residence" value={residence} detail={dormitoryAssignments.find((row: Row) => row.isActive)?.dormitory?.name ?? 'No active dormitory'} />
        <Metric icon={Users} label="Guardians" value={String(guardians.length)} detail={`${discipline.length} discipline record${discipline.length === 1 ? '' : 's'}`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Academic progression</p><h4 className="mt-1 font-black text-slate-900">Class history by academic year</h4></div>
          <Badge tone="blue">History preserved</Badge>
        </div>
        {enrolments.length ? (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {enrolments.map((enrolment: Row, index: number) => (
              <div key={enrolment.id ?? index} className="relative min-w-[210px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#4338CA]">{yearLabel(enrolment)}</p>
                <p className="mt-2 text-lg font-black text-slate-900">{enrolment.class?.name ?? 'Class not recorded'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{[enrolment.class?.stream, enrolment.class?.educationStage, enrolment.term?.name].filter(Boolean).join(' · ') || 'No additional class details'}</p>
                <div className="mt-3"><Badge tone={enrolment.isActive ? 'emerald' : 'slate'}>{enrolment.isActive ? 'Current' : enrolment.promotedAt ? 'Progressed' : 'Completed'}</Badge></div>
              </div>
            ))}
          </div>
        ) : <Empty message="No class-enrolment history is available for this student." />}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Academic performance trend" subtitle="Average score across recorded subjects per term">
          {academicChart.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={academicChart} margin={{ top: 10, right: 12, left: -14, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Average']} />
                <Line type="monotone" dataKey="average" stroke="#4338CA" strokeWidth={3} dot={{ r: 4, fill: '#4338CA' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty message="Performance trend will appear after scored assessments are recorded." />}
        </ChartCard>

        <ChartCard title="Financial journey" subtitle="Invoice, payment and outstanding balance history">
          {financeChart.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={financeChart} margin={{ top: 10, right: 12, left: 2, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => money(value)} />
                <Legend />
                <Bar dataKey="invoiced" name="Invoiced" fill="#4338CA" radius={[5, 5, 0, 0]} />
                <Bar dataKey="paid" name="Paid" fill="#10B981" radius={[5, 5, 0, 0]} />
                <Bar dataKey="balance" name="Balance" fill="#F59E0B" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty message="Financial history will appear when invoices are issued." />}
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailTable title="Education summary" subtitle="Subject results across all available terms" empty="No subject performance records are available." headers={['Subject', 'Average', 'Latest', 'Grade', 'Records']}>
          {subjectSummary.map((row) => <tr key={row.subject} className="border-t border-slate-100"><Cell>{row.subject}</Cell><Cell>{row.average.toFixed(1)}%</Cell><Cell>{row.latestScore.toFixed(1)}%</Cell><Cell><Badge tone={row.grade === 'A' ? 'emerald' : row.grade === 'F' ? 'rose' : 'blue'}>{row.grade}</Badge></Cell><Cell>{row.records}</Cell></tr>)}
        </DetailTable>
        <DetailTable title="Financial account summary" subtitle="Invoices and their current settlement position" empty="No invoices are available for this student." headers={['Invoice', 'Status', 'Total', 'Paid', 'Balance']}>
          {invoices.map((invoice: Row, index: number) => <tr key={invoice.id ?? index} className="border-t border-slate-100"><Cell><span className="font-bold text-slate-800">{invoice.invoiceNumber ?? 'Invoice'}</span><span className="block text-[10px] text-slate-400">{dateLabel(invoice.issuedAt ?? invoice.createdAt)}</span></Cell><Cell><Badge tone={invoice.status === 'PAID' ? 'emerald' : invoice.status === 'OVERDUE' ? 'rose' : 'amber'}>{String(invoice.status ?? 'DRAFT')}</Badge></Cell><Cell>{money(invoice.totalAmount)}</Cell><Cell>{money(invoice.paidAmount)}</Cell><Cell>{money(invoice.outstandingBalance)}</Cell></tr>)}
        </DetailTable>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chronology</p><h4 className="mt-1 font-black text-slate-900">Lifecycle timeline</h4></div>
        {timeline.length ? (
          <ol className="mt-5 space-y-0">
            {timeline.map((event, index) => (
              <li key={`${event.title}-${event.date}-${index}`} className="relative grid grid-cols-[22px_1fr] gap-3 pb-5 last:pb-0">
                {index < timeline.length - 1 && <span className="absolute left-[10px] top-5 h-full w-px bg-slate-200" />}
                <span className="relative mt-1 h-[21px] w-[21px] rounded-full border-4 border-white bg-[#4338CA] shadow ring-1 ring-indigo-200" />
                <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-black text-slate-900">{event.title}</p><time className="text-xs font-bold text-slate-400">{dateLabel(event.date)}</time></div>
                  <p className="mt-1 text-sm font-medium text-slate-600">{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : <Empty message="No dated lifecycle events are available." />}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[#4338CA]"><Icon className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p></div><p className="mt-2 truncate text-xl font-black text-slate-900" title={value}>{value}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400" title={detail}>{detail}</p></div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h4 className="font-black text-slate-900">{title}</h4><p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p><div className="mt-4 min-h-[270px]">{children}</div></section>;
}

function Empty({ message }: { message: string }) {
  return <div className="flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-5 text-center text-sm font-semibold text-slate-500">{message}</div>;
}

function DetailTable({ title, subtitle, empty, headers, children }: { title: string; subtitle: string; empty: string; headers: string[]; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h4 className="font-black text-slate-900">{title}</h4><p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>{hasRows ? <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] text-sm"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div> : <div className="mt-4"><Empty message={empty} /></div>}</section>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-slate-600">{children}</td>;
}
