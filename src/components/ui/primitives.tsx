import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldQuestion, XCircle } from 'lucide-react';
import type { Eligibility } from '@/domain/types';
import { ELIGIBILITY_COPY } from '@/domain/eligibility';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-canvas text-muted border border-line',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`pill ${TONE_CLASS[tone]}`}>{children}</span>;
}

const ELIG_META: Record<Eligibility, { tone: Tone; Icon: typeof CheckCircle2 }> = {
  eligible: { tone: 'success', Icon: CheckCircle2 },
  'not-eligible': { tone: 'danger', Icon: XCircle },
  'needs-information': { tone: 'warning', Icon: CircleHelp },
  unverified: { tone: 'info', Icon: ShieldQuestion },
};

export function EligibilityBadge({ status }: { status: Eligibility }) {
  const { tone, Icon } = ELIG_META[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden="true" size={14} />
      {ELIGIBILITY_COPY[status].label}
    </Badge>
  );
}

export function DemoLabel() {
  return (
    <Badge tone="neutral">
      <AlertTriangle aria-hidden="true" size={13} />
      Sample opportunity
    </Badge>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-[1.02rem] text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string };
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 rounded-full bg-mint p-3 text-forest">{icon}</div> : null}
      <p className="font-display text-xl font-semibold">{title}</p>
      {body ? <p className="mt-2 max-w-md text-muted">{body}</p> : null}
      {action ? (
        <Link href={action.href} className="btn btn-primary mt-5">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = 'Getting your funding journey ready…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-muted">{label}</p>
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-line/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-line/60" />
        <div className="h-40 animate-pulse rounded-2xl bg-line/60" />
      </div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className="h-2.5 w-full overflow-hidden rounded-full bg-mint"
    >
      <div className="h-full rounded-full bg-forest transition-[width] duration-200" style={{ width: `${v}%` }} />
    </div>
  );
}
