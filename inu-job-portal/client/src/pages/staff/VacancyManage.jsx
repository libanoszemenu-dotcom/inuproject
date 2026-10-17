import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Card, CardHeader, ConfirmDialog, ErrorState, PageHeader, PageLoader, StatusBadge, TextAreaField,
} from '../../components/ui';
import { formatDateTime, label } from '../../utils/format';

export default function VacancyManage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: v, loading, error, reload } = useApi(`/vacancies/${id}`);
  const [dialog, setDialog] = useState(null); // 'submit' | 'approve' | 'return' | 'close' | 'delete'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const isHr = user.role === 'hr_officer';
  const isAdmin = user.role === 'admin';

  const DIALOGS = {
    submit: { title: 'Submit for approval?', message: 'The vacancy will be sent for approval and can no longer be edited.', confirm: 'Submit', done: 'Vacancy submitted' },
    approve: { title: 'Approve and publish?', message: 'The vacancy becomes visible to applicants immediately.', confirm: 'Approve and publish', done: 'Vacancy published' },
    return: { title: 'Return to draft?', message: 'The HR officer can edit and resubmit it. Please give a reason.', confirm: 'Return to draft', done: 'Vacancy returned to draft', needsReason: true },
    close: { title: 'Close this vacancy?', message: 'Applicants will no longer be able to apply. Existing applications are kept.', confirm: 'Close vacancy', done: 'Vacancy closed', danger: true },
    delete: { title: 'Delete this draft?', message: 'This permanently deletes the draft.', confirm: 'Delete', done: 'Draft deleted', danger: true },
  };

  async function run() {
    const d = DIALOGS[dialog];
    if (d.needsReason && reason.trim().length < 5) { toast.error('Please enter a reason of at least 5 characters'); return; }
    setBusy(true);
    try {
      if (dialog === 'delete') await api.delete(`/vacancies/${id}`);
      else await api.post(`/vacancies/${id}/${dialog}`, d.needsReason ? { reason: reason.trim() } : undefined);
      toast.success(d.done);
      setDialog(null);
      setReason('');
      if (dialog === 'delete') navigate('/portal/manage/vacancies'); else reload();
    } catch (err) {
      toast.error(errorMessage(err));
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const actions = [];
  if (isHr && v.status === 'draft') {
    actions.push(<Link key="edit" to={`/portal/manage/vacancies/${v.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>);
    actions.push(<button key="submit" type="button" className="btn btn-primary btn-sm" onClick={() => setDialog('submit')}>Submit for approval</button>);
    actions.push(<button key="delete" type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('delete')}>Delete</button>);
  }
  if (isAdmin && v.status === 'pending_approval') {
    actions.push(<button key="approve" type="button" className="btn btn-primary btn-sm" onClick={() => setDialog('approve')}>Approve and publish</button>);
    actions.push(<button key="return" type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('return')}>Return to draft</button>);
  }
  if (v.status === 'published') {
    actions.push(<button key="close" type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('close')}>Close vacancy</button>);
  }
  if (isHr) {
    actions.push(<Link key="apps" to={`/portal/manage/applications?vacancy_id=${v.id}`} className="btn btn-secondary btn-sm">View applications ({v.applications_count})</Link>);
  }

  const d = dialog ? DIALOGS[dialog] : null;

  return (
    <>
      <PageHeader title={v.title} subtitle={`${v.reference_no} \u00b7 ${v.department}`} actions={actions} />
      <div className="mb-6 flex items-center gap-3"><StatusBadge status={v.status} /><span className="text-sm text-slate-500">Deadline {formatDateTime(v.deadline_at)}</span></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Announcement" />
          <div className="space-y-5 p-5 text-sm text-slate-700">
            <div><h3 className="font-semibold text-slate-900">Description</h3><p className="mt-1 whitespace-pre-line">{v.description}</p></div>
            <div><h3 className="font-semibold text-slate-900">Qualifications</h3><p className="mt-1 whitespace-pre-line">{v.qualifications}</p></div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Details" />
          <dl className="space-y-2 p-5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Category</dt><dd>{label(v.category)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Employment</dt><dd>{label(v.employment_type)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Location</dt><dd>{v.location}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Positions</dt><dd>{v.positions_count}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Published</dt><dd>{formatDateTime(v.published_at)}</dd></div>
          </dl>
          <div className="border-t border-slate-200 p-5 text-sm">
            <p className="font-semibold">Required documents</p>
            <ul className="mt-2 list-inside list-disc text-slate-700">{v.required_documents.map((x) => <li key={x.code}>{x.name}</li>)}</ul>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(dialog)}
        title={d?.title || ''}
        message={d?.message || ''}
        confirmLabel={d?.confirm}
        danger={Boolean(d?.danger)}
        busy={busy}
        onConfirm={run}
        onCancel={() => { setDialog(null); setReason(''); }}
      >
        {d?.needsReason && (
          <div className="mt-4"><TextAreaField label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
        )}
      </ConfirmDialog>
    </>
  );
}
