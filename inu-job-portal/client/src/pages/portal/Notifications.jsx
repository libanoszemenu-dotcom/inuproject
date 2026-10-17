import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

export default function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { data, meta, loading, error, reload } = useApi('/notifications', { page, page_size: 10, unread: onlyUnread ? 'true' : '' });

  const changed = () => { reload(); window.dispatchEvent(new Event('notifications:changed')); };

  async function markRead(id) {
    try { await api.patch(`/notifications/${id}/read`); changed(); } catch (err) { toast.error(errorMessage(err)); }
  }
  async function markAll() {
    try { await api.post('/notifications/read-all'); changed(); } catch (err) { toast.error(errorMessage(err)); }
  }

  const appLink = (id) => (user.role === 'applicant' ? `/portal/applications/${id}` : `/portal/manage/applications/${id}`);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={meta ? `${meta.unread_count} unread` : undefined}
        actions={<button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>Mark all as read</button>}
      />
      <label className="mb-4 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyUnread} onChange={(e) => { setOnlyUnread(e.target.checked); setPage(1); }} />
        Show unread only
      </label>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No notifications" message="Updates about your applications and interviews will appear here." />
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-slate-100">
              {data.map((n) => (
                <li key={n.id} className={`flex items-start justify-between gap-4 px-5 py-4 ${n.is_read ? '' : 'bg-brand-50'}`}>
                  <div>
                    <p className="font-semibold">{!n.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate-700">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(n.created_at)}</p>
                    {n.application_id && <Link to={appLink(n.application_id)} className="mt-1 inline-block text-sm font-semibold">View application</Link>}
                  </div>
                  {!n.is_read && <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => markRead(n.id)}>Mark read</button>}
                </li>
              ))}
            </ul>
          </Card>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}
    </>
  );
}
