import { type FormEvent, type ReactNode, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Headphones, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { KilimanjaroMark } from '../../components/icons/KilimanjaroMark';
import { api } from '../../lib/api/client';
import { endpoints } from '../../lib/api/endpoints';
import { normalizeApiError } from '../../lib/api/errors';

const supportEmail = 'support@kilimanjaroschools.site';
const updatedDate = '28 September 2026';

function PublicPage({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ks-paper text-on-surface">
      <header className="border-b border-ks-line bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-3">
            <KilimanjaroMark />
            <span className="font-display text-lg font-bold text-ks-navy">Kilimanjaro Schools</span>
          </Link>
          <Link to="/login"><Button variant="secondary">Staff login</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-ks-blue hover:underline"><ArrowLeft className="h-4 w-4" /> Back to Kilimanjaro Schools</Link>
        <div className="mt-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ks-blue">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-black text-ks-navy md:text-5xl">{title}</h1>
          <p className="mt-5 text-base leading-7 text-ks-muted md:text-lg">{description}</p>
          <p className="mt-4 text-sm text-ks-muted">Last updated: {updatedDate}</p>
        </div>
        <div className="mt-12 max-w-3xl space-y-10 text-[15px] leading-7 text-slate-700">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="font-display text-2xl font-bold text-ks-navy">{title}</h2><div className="mt-3 space-y-3">{children}</div></section>;
}

function PublicFooter() {
  return (
    <footer className="border-t border-ks-line bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-ks-muted md:flex-row md:items-center md:justify-between">
        <span>Copyright 2026 Kilimanjaro Schools.</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-ks-navy">
          <Link to="/privacy-policy" className="hover:text-ks-blue">Privacy</Link>
          <Link to="/terms-of-service" className="hover:text-ks-blue">Terms</Link>
          <Link to="/account-deletion" className="hover:text-ks-blue">Delete account</Link>
          <Link to="/support" className="hover:text-ks-blue">Support</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PublicPage eyebrow="Legal and privacy" title="Privacy Policy" description="How Kilimanjaro Schools collects, uses, protects, and retains information in the staff portal and mobile application.">
      <Section title="Who this policy covers"><p>This policy covers the Kilimanjaro Schools web portal and mobile application. Schools using the platform remain responsible for their school records and for informing students, parents, guardians, staff, and other authorized users about local data handling practices.</p></Section>
      <Section title="Information we process"><p>We process account and contact details, school and class assignments, attendance, assessment and report-card information, fees and payment records, guardian links, communications, device details, security logs, and support requests. We collect only the information needed to operate school services and meet applicable obligations.</p></Section>
      <Section title="How information is used"><p>Information is used to authenticate users, provide role-based school operations, communicate school notices, generate academic and finance records, protect accounts, investigate incidents, improve reliability, and comply with legal or regulatory duties.</p></Section>
      <Section title="Sharing and access"><p>Access is limited by role, school membership, and family relationships. We may use carefully selected service providers for hosting, email, notifications, storage, and support. We disclose information to authorities only where required by law or to protect people, school property, or system security.</p></Section>
      <Section title="Children and student information"><p>Student accounts and records are managed through their school. Parents or guardians should contact the school first for student-record corrections, access requests, or consent matters. We do not use student information for advertising or sell personal information.</p></Section>
      <Section title="Security and retention"><p>We use access controls, encryption in transit, audit logging, and operational safeguards. No system can guarantee absolute security. We retain information while an account or school relationship is active and afterwards only as needed for academic records, finance records, safeguarding, fraud prevention, backups, dispute resolution, and legal obligations.</p></Section>
      <Section title="Your choices and requests"><p>You may request access, correction, deletion, or other privacy assistance through your school or by contacting <a className="font-bold text-ks-blue hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>. Account deletion requests can also be submitted through the public <Link className="font-bold text-ks-blue hover:underline" to="/account-deletion">Account Deletion page</Link>.</p></Section>
      <Section title="Policy updates"><p>We may update this policy as the service, applicable law, or school operations change. The current version is published at this URL.</p></Section>
    </PublicPage>
  );
}

export function TermsOfServicePage() {
  return (
    <PublicPage eyebrow="Legal agreement" title="Terms of Service" description="Rules for authorized use of the Kilimanjaro Schools web portal and mobile application.">
      <Section title="Authorized use"><p>Kilimanjaro Schools is provided to authorized schools, staff, students, parents, guardians, and other approved users. You must use only the account assigned to you, protect your credentials, and follow your school's acceptable-use policies.</p></Section>
      <Section title="Account responsibility"><p>Do not share passwords, bypass permissions, attempt to access another person's records, upload malicious material, or interfere with the platform. Notify your school immediately if you suspect unauthorized access to an account.</p></Section>
      <Section title="School records and decisions"><p>The platform supports school operations but does not replace a school's professional, academic, financial, safeguarding, or legal judgement. Schools remain responsible for the accuracy of the records they enter and for decisions made using those records.</p></Section>
      <Section title="Availability and changes"><p>We work to keep the service available and secure, but maintenance, third-party dependencies, connectivity, or security actions may affect availability. Features may change as the platform evolves. Material policy changes will be published on this site.</p></Section>
      <Section title="Content and acceptable conduct"><p>You retain responsibility for information you submit. Do not submit content that is unlawful, harmful, misleading, infringing, or unrelated to school operations. We may suspend access needed to protect users, schools, or the platform.</p></Section>
      <Section title="Support and contact"><p>For account, technical, or legal questions, use the <Link className="font-bold text-ks-blue hover:underline" to="/support">Support page</Link> or email <a className="font-bold text-ks-blue hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p></Section>
    </PublicPage>
  );
}

export function SupportPage() {
  return (
    <PublicPage eyebrow="Help and support" title="Kilimanjaro Schools Support" description="Help for account access, the mobile application, student records, and privacy requests.">
      <div className="grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${supportEmail}`} className="rounded-lg border border-ks-line bg-white p-6 transition hover:border-ks-blue hover:shadow-sm"><Mail className="h-6 w-6 text-ks-blue" /><h2 className="mt-4 font-display text-xl font-bold text-ks-navy">Email support</h2><p className="mt-2 text-sm text-ks-muted">{supportEmail}</p></a>
        <Link to="/account-deletion" className="rounded-lg border border-ks-line bg-white p-6 transition hover:border-ks-blue hover:shadow-sm"><Trash2 className="h-6 w-6 text-ks-rose" /><h2 className="mt-4 font-display text-xl font-bold text-ks-navy">Account deletion</h2><p className="mt-2 text-sm text-ks-muted">Submit a deletion request or read what information may be retained.</p></Link>
      </div>
      <Section title="Before contacting support"><p>Include your full name, school name, registered email or student registration number, device type, and a clear description of the problem. Do not send passwords, one-time codes, full payment card details, or sensitive student records by email.</p></Section>
      <Section title="School records"><p>For timetable, academic results, attendance, fee balances, or guardian details, contact your school office first. The school is best placed to confirm and correct its records.</p></Section>
      <Section title="Security"><p>If you think your account has been accessed by someone else, change your password immediately and report the issue to your school administrator and support.</p></Section>
    </PublicPage>
  );
}

export function AccountDeletionPage() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('submitting');
    setError('');
    try {
      await api.post(endpoints.auth.accountDeletionRequest, { email, reason: reason || undefined });
      setState('success');
    } catch (requestError) {
      setState('error');
      setError(normalizeApiError(requestError).message || 'Unable to submit the request. Please try again or contact support.');
    }
  }

  return (
    <PublicPage eyebrow="Privacy request" title="Delete your Kilimanjaro Schools account" description="Use this page to request deletion of your account credentials from outside the mobile application.">
      <div className="rounded-lg border border-ks-amber/30 bg-ks-amber/10 p-5 text-sm text-ks-slate"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ks-amber" /><p>For security, requests are verified with the school and account holder before action. We do not reveal whether an email has an account.</p></div></div>
      <Section title="What deletion means"><p>After identity and authority verification, we revoke access and delete or deactivate account credentials within 30 days. A school may need to retain academic, attendance, safeguarding, financial, legal, and audit records even after the account is deleted. We will explain any retention that applies to your request.</p></Section>
      <Section title="For student accounts"><p>A parent, guardian, or authorized school representative should submit the request for a student account. The school will be asked to confirm authority before any action is taken.</p></Section>
      <section className="rounded-lg border border-ks-line bg-white p-6 md:p-8">
        <div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ks-rose/10 text-ks-rose"><Trash2 className="h-5 w-5" /></div><div><h2 className="font-display text-2xl font-bold text-ks-navy">Submit a deletion request</h2><p className="mt-1 text-sm text-ks-muted">Use the email address associated with the account where available.</p></div></div>
        {state === 'success' ? <div className="mt-6 flex gap-3 rounded-lg border border-ks-emerald/30 bg-ks-emerald/10 p-4 text-sm text-ks-slate"><CheckCircle2 className="h-5 w-5 shrink-0 text-ks-emerald" /><p>Your request has been recorded for verification and processing. If it can be matched to an account, the school or support team will follow up through an appropriate channel.</p></div> : <form className="mt-6 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-bold text-ks-navy">Account email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-lg border border-ks-line bg-white px-3 py-2.5 text-ks-slate" placeholder="name@example.com" /></label>
          <label className="block text-sm font-bold text-ks-navy">Reason (optional)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={4} className="mt-2 block w-full rounded-lg border border-ks-line bg-white px-3 py-2.5 text-ks-slate" placeholder="For example, I no longer use this account." /></label>
          {state === 'error' && <p className="rounded-lg border border-ks-rose/30 bg-ks-rose/10 p-3 text-sm text-ks-rose">{error}</p>}
          <Button type="submit" loading={state === 'submitting'} className="w-full sm:w-auto">Submit deletion request</Button>
        </form>}
      </section>
      <Section title="Need help"><p>If you cannot access the form or do not have an email linked to the account, contact <a className="font-bold text-ks-blue hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> and include your school name and available account details. Do not include passwords or one-time codes.</p></Section>
    </PublicPage>
  );
}

export function LegalLinksPage() {
  const links = [
    { to: '/privacy-policy', title: 'Privacy Policy', description: 'How personal and school information is processed.', Icon: ShieldCheck },
    { to: '/terms-of-service', title: 'Terms of Service', description: 'Rules for authorized use of the platform.', Icon: FileText },
    { to: '/account-deletion', title: 'Account Deletion', description: 'Submit a deletion request outside the app.', Icon: Trash2 },
    { to: '/support', title: 'Support', description: 'Account, technical, and privacy assistance.', Icon: Headphones },
  ];
  return <PublicPage eyebrow="Kilimanjaro Schools" title="Public policies and support" description="Public links for the Kilimanjaro Schools mobile application and staff portal."><div className="grid gap-4 sm:grid-cols-2">{links.map(({ to, title, description, Icon }) => <Link key={to} to={to} className="rounded-lg border border-ks-line bg-white p-6 transition hover:border-ks-blue hover:shadow-sm"><Icon className="h-6 w-6 text-ks-blue" /><h2 className="mt-4 font-display text-xl font-bold text-ks-navy">{title}</h2><p className="mt-2 text-sm leading-6 text-ks-muted">{description}</p></Link>)}</div></PublicPage>;
}
