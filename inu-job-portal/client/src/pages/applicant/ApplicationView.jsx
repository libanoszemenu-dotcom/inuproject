import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import Timeline from '../../components/Timeline';
import {
  Card, CardHeader, ConfirmDialog, ErrorState, PageHeader, PageLoader, StatusBadge, TextAreaField,
} from '../../components/ui';
import { TERMINAL_STATUSES, formatBytes, formatDateTime, label } from '../../utils/format';

export default function ApplicationView() {
  const { id } = useParams();
  const toast = useToast();
  const { data: a, loading, error, reload } = useApi(`/applications/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    setBusy(true);
    try {
      await api.post(`/applications/${id}/withdraw`, reason.trim() ? { reason: reason.trim() } : {});
      toast.success('Application withdrawn');
      setConfirm(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const canWithdraw = !TERMINAL_STATUSES.includes(a.status);
  const scheduled = a.interviews.filter((i) => i.status === 'scheduled');

  return (
    <>
      <PageHeader
        title={`Application ${a.application_no}`}
        subtitle={a.vacancy.title}
        actions={
          <>
            <Link to={`/vacancies/${a.vacancy.id}`} className="btn btn-secondary btn-sm">View vacancy</Link>
            {canWithdraw && <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>Withdraw application</button>}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">Current status:</span>
        <StatusBadge status={a.status} />
        <span className="text-sm text-slate-500">Submitted {formatDateTime(a.submitted_at)}</span>
      </div>

      {scheduled.map((i) => (
        <div key={i.id} className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5" role="note">
          <p className="font-semibold text-amber-900">Interview invitation</p>
          <p className="mt-1 text-sm text-amber-900">
            {formatDateTime(i.scheduled_at)} &middot; {i.location} ({label(i.mode)})
          </p>
          {i.notes && <p className="mt-1 text-sm text-amber-900">{i.notes}</p>}
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Progress history" />
          <Timeline items={a.history} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="My documents" />
            <ul className="divide-y divide-slate-100">
              {a.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{d.type_name}</p>
                    <p className="truncate text-xs text-slate-500">{d.original_name} ({formatBytes(d.size_bytes)})</p>
                  </div>
                  <a className="btn btn-ghost btn-sm" href={`/api/documents/${d.id}/download`}>Download</a>
                </li>
              ))}
              {a.documents.length === 0 && <li className="px-5 py-3 text-sm text-slate-500">No documents on file.</li>}
            </ul>
          </Card>
          {a.cover_note && (
            <Card>
              <CardHeader title="Cover note" />
              <p className="whitespace-pre-line p-5 text-sm text-slate-700">{a.cover_note}</p>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Withdraw this application?"
        message="This cannot be undone. You will not be considered for this vacancy any further."
        confirmLabel="Withdraw"
        danger
        busy={busy}
        onConfirm={withdraw}
        onCancel={() => setConfirm(false)}
      >
        <div className="mt-4">
          <TextAreaField label="Reason (optional)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </div>
      </ConfirmDialog>
    </>
  );
}
