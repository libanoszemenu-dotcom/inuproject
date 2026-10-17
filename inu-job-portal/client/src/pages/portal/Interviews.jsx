import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, SelectField, StatusBadge, Table,
} from '../../components/ui';
import { formatDateTime, label } from '../../utils/format';

export default function Interviews() {
  const { user } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [upcoming, setUpcoming] = useState('');
  const [pending, setPending] = useState(null); // { id, action: 'cancel' | 'complete' }
  const [busy, setBusy] = useState(false);
  const { data, meta, loading, error, reload } = useApi('/interviews', { page, page_size: 10, status, upcoming });

  const isHr = user.role === 'hr_officer';
  const isApplicant = user.role === 'applicant';

  async function runAction() {
    setBusy(true);
    try {
      await api.post(`/interviews/${pending.id}/${pending.action}`);
      toast.success(pending.action === 'cancel' ? 'Interview cancelled' : 'Interview marked as completed');
      setPending(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const headers = ['When', 'Vacancy', 'Application', ...(isApplicant ? [] : ['Applicant']), 'Where', 'Status', ''];

  return (
    <>
      <PageHeader title="Interviews" subtitle={isApplicant ? 'Your interview invitations.' : 'Scheduled and past interviews.'} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <SelectField label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </SelectField>
        <SelectField label="Time" value={upcoming} onChange={(e) => { setUpcoming(e.target.value); setPage(1); }}>
          <option value="">Any time</option>
          <option value="true">Upcoming only</option>
        </SelectField>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No interviews found" message={isHr ? 'Interviews are scheduled from a shortlisted application.' : 'Nothing is scheduled yet.'} />
      ) : (
        <>
          <Card>
            <Table headers={headers} caption="Interviews">
              {data.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDateTime(i.scheduled_at)} <span className="font-normal text-slate-500">({i.duration_minutes} min)</span></td>
                  <td className="px-4 py-3">{i.vacancy_title}</td>
                  <td className="px-4 py-3">{i.application_no}</td>
                  {!isApplicant && <td className="px-4 py-3">{i.applicant_name}</td>}
                  <td className="px-4 py-3">{i.location} <span className="text-slate-500">({label(i.mode)})</span></td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {isApplicant && <Link to={`/portal/applications/${i.application_id}`} className="btn btn-ghost btn-sm">Open</Link>}
                    {!isApplicant && <Link to={`/portal/manage/applications/${i.application_id}`} className="btn btn-ghost btn-sm">{isHr ? 'Review' : 'Feedback'}</Link>}
                    {isHr && i.status === 'scheduled' && (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm ml-1" onClick={() => setPending({ id: i.id, action: 'complete' })}>Complete</button>
                        <button type="button" className="btn btn-secondary btn-sm ml-1" onClick={() => setPending({ id: i.id, action: 'cancel' })}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.action === 'cancel' ? 'Cancel this interview?' : 'Mark interview as completed?'}
        message={pending?.action === 'cancel'
          ? 'The applicant will be notified and the application returns to the shortlisted stage.'
          : 'The applicant will be notified and the application moves to "Interview completed".'}
        confirmLabel={pending?.action === 'cancel' ? 'Cancel interview' : 'Mark completed'}
        danger={pending?.action === 'cancel'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
