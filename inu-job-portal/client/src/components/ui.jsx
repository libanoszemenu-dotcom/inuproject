import { useEffect, useId, useRef } from 'react';
import { statusLabel } from '../utils/format';

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner className="h-6 w-6 text-brand-600" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-semibold">Could not load this content</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const BADGE = {
  submitted: 'bg-slate-100 text-slate-700',
  under_review: 'bg-blue-100 text-blue-800',
  screened: 'bg-cyan-100 text-cyan-800',
  shortlisted: 'bg-indigo-100 text-indigo-800',
  interview_scheduled: 'bg-amber-100 text-amber-800',
  interview_completed: 'bg-orange-100 text-orange-800',
  selected: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-200 text-slate-700',
  draft: 'bg-slate-100 text-slate-700',
  pending_approval: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  closed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
  scheduled: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status }) {
  const cls = BADGE[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

export function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  default: 'border-slate-200',
  brand: 'border-l-4 border-l-brand-600 border-slate-200',
  gold: 'border-l-4 border-l-accent-500 border-slate-200',
  green: 'border-l-4 border-l-green-600 border-slate-200',
  red: 'border-l-4 border-l-red-600 border-slate-200',
};

export function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${TONES[tone]}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value ?? 0}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Progress({ percent }) {
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function Pagination({ meta, onChange }) {
  if (!meta) return null;
  if (meta.total_pages <= 1) return <p className="mt-3 text-sm text-slate-500">{meta.total} result(s)</p>;
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-slate-500">Page {meta.page} of {meta.total_pages} ({meta.total} results)</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>Previous</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={meta.page >= meta.total_pages} onClick={() => onChange(meta.page + 1)}>Next</button>
      </div>
    </nav>
  );
}

export function Table({ headers, children, caption }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

// ---------- form fields (each one links its label and error message for screen readers) ----------
function Wrapper({ id, label, required, error, hint, className, children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function TextField({ label, error, hint, className = '', ...props }) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} required={props.required} error={error} hint={hint} className={className}>
      <input id={id} className={`input ${error ? 'border-red-500' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...props} />
    </Wrapper>
  );
}

export function SelectField({ label, error, hint, className = '', children, ...props }) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} required={props.required} error={error} hint={hint} className={className}>
      <select id={id} className={`input ${error ? 'border-red-500' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}

export function TextAreaField({ label, error, hint, className = '', rows = 4, ...props }) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} required={props.required} error={error} hint={hint} className={className}>
      <textarea id={id} rows={rows} className={`input ${error ? 'border-red-500' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...props} />
    </Wrapper>
  );
}

// ---------- dialogs ----------
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // always call the latest onClose without re-running the effect

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    if (ref.current) ref.current.focus(); // focus once, when the dialog opens
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close dialog">&#10005;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">{message}</p>
      {children}
    </Modal>
  );
}
