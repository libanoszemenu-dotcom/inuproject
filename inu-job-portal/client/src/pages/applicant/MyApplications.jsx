import { useState } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, StatusBadge, Table } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

export default function MyApplications() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/applications/mine', { page, page_size: 10 });

  return (
    <>
      <PageHeader title="My applications" subtitle="Track the status of every application you have submitted." actions={<Link to="/vacancies" className="btn btn-primary">Browse vacancies</Link>} />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="You have not applied yet" message="Find an open vacancy and submit your first application." action={<Link to="/vacancies" className="btn btn-primary">Find vacancies</Link>} />
      ) : (
        <>
          <Card>
            <Table headers={['Application', 'Vacancy', 'Submitted', 'Status', '']} caption="My applications">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">{a.application_no}</td>
                  <td className="px-4 py-3">{a.vacancy_title}<span className="block text-xs text-slate-500">{a.vacancy_reference}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.submitted_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right"><Link to={`/portal/applications/${a.id}`} className="btn btn-ghost btn-sm">Details</Link></td>
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
