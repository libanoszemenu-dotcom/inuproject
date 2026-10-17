import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import {
  Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, SelectField, StatusBadge, Table, TextField,
} from '../../components/ui';
import { STATUS_OPTIONS } from '../../utils/options';
import { formatDateTime } from '../../utils/format';

export default function ApplicationList() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const vacancy_id = params.get('vacancy_id') || '';
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const [draftQ, setDraftQ] = useState(q);
  const { data, meta, loading, error, reload } = useApi('/applications', { status, vacancy_id, q, page, page_size: 10 });

  const isDeptHead = user.role === 'department_head';

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  return (
    <>
      <PageHeader
        title={isDeptHead ? 'Assigned applications' : 'Applications'}
        subtitle={isDeptHead ? 'Applications of your department and those HR has assigned to you.' : vacancy_id ? `Filtered by vacancy #${vacancy_id}` : 'Review, screen and shortlist applicants.'}
      />
      <form className="mb-4 grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); update({ q: draftQ.trim() }); }} role="search">
        <TextField label="Applicant name or application number" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
        <SelectField label="Status" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </SelectField>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn btn-secondary">Search</button>
          {(vacancy_id || status || q) && <button type="button" className="btn btn-ghost" onClick={() => { setDraftQ(''); setParams(new URLSearchParams()); }}>Clear</button>}
        </div>
      </form>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No applications found" message={isDeptHead ? 'No applications for your department yet.' : 'Try changing the filters.'} />
      ) : (
        <>
          <Card>
            <Table headers={['Application', 'Applicant', 'Vacancy', 'Submitted', 'Status', '']} caption="Applications">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{a.application_no}</td>
                  <td className="px-4 py-3">{a.applicant_name}</td>
                  <td className="px-4 py-3">{a.vacancy_title}<span className="block text-xs text-slate-500">{a.vacancy_reference}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.submitted_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right"><Link to={`/portal/manage/applications/${a.id}`} className="btn btn-ghost btn-sm">{isDeptHead ? 'Open' : 'Review'}</Link></td>
                </tr>
              ))}
            </Table>
          </Card>
          <Pagination meta={meta} onChange={(p) => update({ page: String(p) })} />
        </>
      )}
    </>
  );
}
