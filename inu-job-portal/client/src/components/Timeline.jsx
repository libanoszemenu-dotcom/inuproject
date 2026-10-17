import { formatDateTime, statusLabel } from '../utils/format';

/** Status history, newest at the bottom. Each item: { to_status, reason, changed_at, changed_by_name? } */
export default function Timeline({ items }) {
  return (
    <ol className="relative ml-3 border-l-2 border-slate-200 px-5 py-4">
      {items.map((h, i) => (
        <li key={`${h.changed_at}-${i}`} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-200" aria-hidden="true" />
          <p className="text-sm font-semibold">{statusLabel(h.to_status)}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(h.changed_at)}{h.changed_by_name ? ` \u00b7 ${h.changed_by_name}` : ''}
          </p>
          {h.reason && <p className="mt-1 text-sm text-slate-700">{h.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
