import { useState } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import {
  Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, SelectField, StatusBadge, Table, TextField,
} from '../../components/ui';
import { formatDateTime } from '../../utils/format';

export default function VacancyList() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, meta, loading, error, reload } = useApi('/vacancies/manage/list', { page, page_size: 10, status, q: search });

  const isHr = user.role === 'hr_officer';

  return (
    <>
      <PageHeader
        title={isHr ? 'Vacancies' : 'Vacancy approvals'}
        subtitle={isHr ? 'Create, submit and close vacancy announcements.' : 'Review vacancies waiting for approval.'}
        actions={isHr && <Link to="/portal/manage/vacancies/new" className="btn btn-primary">New vacancy</Link>}
      />
      <form className="mb-4 grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }} role="search">
        <TextField label="Search title or reference" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending approval</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </SelectField>
        <div className="flex items-end"><button type="submit" className="btn btn-secondary">Search</button></div>
      </form>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No vacancies found" message={isHr ? 'Create your first vacancy to get started.' : 'Nothing matches the current filters.'} />
      ) : (
        <>
          <Card>
            <Table headers={['Reference', 'Title', 'Department', 'Status', 'Deadline', 'Applications', '']} caption="Vacancies">
              {data.map((v) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap px-4 py-3">{v.reference_no}</td>
                  <td className="px-4 py-3 font-medium">{v.title}</td>
                  <td className="px-4 py-3">{v.department}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(v.deadline_at)}</td>
                  <td className="px-4 py-3">{v.applications_count}</td>
                  <td className="px-4 py-3 text-right"><Link to={`/portal/manage/vacancies/${v.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                </tr>
              ))}
            </Table>
          </Card>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}
    </>
  );
}
