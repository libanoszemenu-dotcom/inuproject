export default function Brand({ light = false }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 shadow" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#16314d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={`block text-base font-bold ${light ? 'text-white' : 'text-brand-900'}`}>Injibara University</span>
        <span className={`block text-xs ${light ? 'text-brand-200' : 'text-slate-500'}`}>Recruitment Portal</span>
      </span>
    </span>
  );
}
