import { useState } from 'react';
import useApi from '../../hooks/useApi';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, Table, TextField } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

function LoginEvents() {
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState('');
  const { data, meta, loading, error, reload } = useApi('/audit-logs/logins', { page, page_size: 15, success });
  return (
    <>
      <div className="mb-4 max-w-xs">
        <label className="label" htmlFor="ok">Result</label>
        <select id="ok" className="input" value={success} onChange={(e) => { setSuccess(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="1">Successful</option><option value="0">Failed</option>
        </select>
      </div>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState title="No login events" message="Nothing matches the current filter." />
      ) : (
        <>
          <Card>
            <Table headers={['Time', 'User', 'Email', 'Method', 'Result', 'IP']} caption="Login events">
              {data.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(l.created_at)}</td>
                  <td className="px-4 py-3">{l.user_name || '-'}</td>
                  <td className="px-4 py-3">{l.email || '-'}</td>
                  <td className="px-4 py-3">{l.method}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {l.success ? 'Success' : `Failed${l.failure_reason ? ` (${l.failure_reason})` : ''}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">{l.ip_address || '-'}</td>
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

export default function AuditLogs() {
  const [tab, setTab] = useState('actions');
  return (
    <>
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Log type">
        <button type="button" role="tab" aria-selected={tab === 'actions'} className={`btn btn-sm ${tab === 'actions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('actions')}>Audit log</button>
        <button type="button" role="tab" aria-selected={tab === 'logins'} className={`btn btn-sm ${tab === 'logins' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('logins')}>Login events</button>
      </div>
      {tab === 'actions' ? <ActionLog /> : <LoginEvents />}
    </>
  );
}

function ActionLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [filters, setFilters] = useState({ action: '', entity_type: '' });
  const { data, meta, loading, error, reload } = useApi('/audit-logs', { page, page_size: 15, ...filters });

  return (
    <>
      <PageHeader title="Audit logs" subtitle="A record of sensitive actions: logins, vacancy changes, status changes, document downloads and more." />
      <form
        className="mb-4 grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => { e.preventDefault(); setFilters({ action: action.trim(), entity_type: entity.trim() }); setPage(1); }}
        role="search"
      >
        <TextField label="Action (exact, e.g. auth.login)" value={action} onChange={(e) => setAction(e.target.value)} />
        <TextField label="Record type (e.g. application)" value={entity} onChange={(e) => setEntity(e.target.value)} />
        <div className="flex items-end"><button type="submit" className="btn btn-secondary">Filter</button></div>
      </form>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No log entries" message="Nothing matches the current filters." />
      ) : (
        <>
          <Card>
            <Table headers={['Time', 'User', 'Action', 'Record', 'IP', 'Details']} caption="Audit log entries">
              {data.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(l.created_at)}</td>
                  <td className="px-4 py-3">{l.user_name || 'Anonymous'}</td>
                  <td className="px-4 py-3 font-medium">{l.action}</td>
                  <td className="whitespace-nowrap px-4 py-3">{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                  <td className="px-4 py-3">{l.ip_address || '-'}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-600" title={l.details ? JSON.stringify(l.details) : ''}>
                    {l.details ? JSON.stringify(l.details) : '-'}
                  </td>
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
