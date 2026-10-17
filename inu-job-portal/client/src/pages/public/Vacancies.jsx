import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { EmptyState, ErrorState, PageLoader, Pagination, SelectField, TextField } from '../../components/ui';
import { formatDate, label } from '../../utils/format';

export function VacancyCard({ vacancy: v }) {
  return (
    <article className="card flex flex-col p-5 transition hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{v.department}</p>
      <h3 className="mt-1 text-lg font-semibold">
        <Link to={`/vacancies/${v.id}`} className="text-slate-900 hover:text-brand-700">{v.title}</Link>
      </h3>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{label(v.category)}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{label(v.employment_type)}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{v.location}</span>
      </div>
      <p className="mt-auto pt-4 text-sm text-slate-600">
        {v.positions_count} position(s) &middot; Deadline <strong>{formatDate(v.deadline_at)}</strong>
      </p>
      <Link to={`/vacancies/${v.id}`} className="btn btn-secondary btn-sm mt-3 self-start">View details</Link>
    </article>
  );
}

export default function Vacancies() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const department_id = params.get('department_id') || '';
  const category = params.get('category') || '';
  const employment_type = params.get('employment_type') || '';
  const page = Number(params.get('page') || 1);

  const [draftQ, setDraftQ] = useState(q);
  const lookups = useApi('/meta/lookups');
  const list = useApi('/vacancies', { q, department_id, category, employment_type, page, page_size: 9 });

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  function onSubmit(e) {
    e.preventDefault();
    update({ q: draftQ.trim() });
  }

  const departments = lookups.data?.departments || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Open vacancies</h1>
      <p className="mt-1 text-slate-600">Search and filter the current announcements.</p>

      <form onSubmit={onSubmit} className="card mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5" role="search" aria-label="Filter vacancies">
        <TextField label="Keyword" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="e.g. lecturer" className="lg:col-span-2" />
        <SelectField label="Department" value={department_id} onChange={(e) => update({ department_id: e.target.value })}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
        <SelectField label="Category" value={category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          <option value="academic">Academic</option>
          <option value="administrative">Administrative</option>
          <option value="technical">Technical</option>
        </SelectField>
        <SelectField label="Employment type" value={employment_type} onChange={(e) => update({ employment_type: e.target.value })}>
          <option value="">All types</option>
          <option value="full_time">Full time</option>
          <option value="part_time">Part time</option>
          <option value="contract">Contract</option>
        </SelectField>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="btn btn-primary">Search</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setDraftQ(''); setParams(new URLSearchParams()); }}>Clear filters</button>
        </div>
      </form>

      <div className="mt-6">
        {list.loading ? (
          <PageLoader />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.data.length === 0 ? (
          <EmptyState title="No vacancies match your search" message="Try different keywords or clear the filters." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.data.map((v) => <VacancyCard key={v.id} vacancy={v} />)}
            </div>
            <Pagination meta={list.meta} onChange={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>
    </div>
  );
}
