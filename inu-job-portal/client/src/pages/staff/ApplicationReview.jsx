import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Timeline from '../../components/Timeline';
import ProfileSections from '../../components/ProfileSections';
import {
  Card, CardHeader, ErrorState, Modal, PageHeader, PageLoader, SelectField, Spinner, StatusBadge, TextAreaField, TextField,
} from '../../components/ui';
import { TERMINAL_STATUSES, formatBytes, formatDateTime, label, statusLabel } from '../../utils/format';

const ACTION_LABELS = {
  under_review: 'Start review', screened: 'Mark as screened', shortlisted: 'Shortlist',
  selected: 'Select candidate', rejected: 'Reject',
};

// ---------- change status (HR and Department Head) ----------
function StatusModal({ appId, to, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const needsReason = to === 'rejected';

  async function submit() {
    if (needsReason && reason.trim().length < 5) { toast.error('A reason of at least 5 characters is required'); return; }
    setBusy(true);
    try {
      await api.post(`/applications/${appId}/status`, { to_status: to, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      toast.success(`Status changed to "${statusLabel(to)}"`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`${ACTION_LABELS[to]}?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`btn ${needsReason ? 'btn-danger' : 'btn-primary'}`} onClick={submit} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Confirm
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">The applicant will be notified of this change.</p>
      <div className="mt-4">
        <TextAreaField
          label={needsReason ? 'Reason (shown to the applicant)' : 'Note (optional, shown to the applicant)'}
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required={needsReason}
        />
      </div>
    </Modal>
  );
}

// ---------- schedule interview (HR) ----------
function InterviewModal({ appId, directory, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ scheduled_at: '', duration_minutes: 45, location: '', mode: 'in_person', notes: '' });
  const [panel, setPanel] = useState([]);
  const [conflicts, setConflicts] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));
  const toggle = (uid) => { setConflicts(null); setPanel((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid])); };

  async function checkAvailability() {
    try {
      const res = await api.post('/interviews/check-conflicts', {
        application_id: Number(appId), scheduled_at: form.scheduled_at, duration_minutes: Number(form.duration_minutes), panel_member_ids: panel,
      });
      setConflicts(res.data.data.conflicts);
      if (!res.data.data.has_conflicts) toast.success('Everyone is available at this time');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.post('/interviews', { application_id: Number(appId), ...form, duration_minutes: Number(form.duration_minutes), panel_member_ids: panel });
      toast.success('Interview scheduled and applicant notified');
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      if (err?.response?.status === 409) setConflicts(err.response.data.errors || []);
      toast.error(err?.response?.status === 409 ? 'Schedule conflict: see the details below' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Schedule interview" wide onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label="Date and time" type="datetime-local" required value={form.scheduled_at} onChange={(e) => { setConflicts(null); set('scheduled_at')(e); }} error={errors.scheduled_at} />
        <SelectField label="Duration" value={form.duration_minutes} onChange={(e) => { setConflicts(null); set('duration_minutes')(e); }}>
          {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </SelectField>
        <SelectField label="Mode" value={form.mode} onChange={set('mode')}>
          <option value="in_person">In person</option>
          <option value="online">Online</option>
        </SelectField>
        <TextField className="sm:col-span-2" label="Location or meeting link" required value={form.location} onChange={set('location')} error={errors.location} />
        <TextAreaField className="sm:col-span-2" label="Notes for the applicant (optional)" rows={2} value={form.notes} onChange={set('notes')} maxLength={500} />
        <fieldset className="sm:col-span-2">
          <legend className="label">Interview panel <span className="text-red-600" aria-hidden="true">*</span></legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {directory.map((u) => (
              <label key={u.id} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={panel.includes(u.id)} onChange={() => toggle(u.id)} />
                {u.full_name} <span className="text-xs text-slate-500">({label(u.role)})</span>
              </label>
            ))}
          </div>
          {errors.panel_member_ids && <p className="mt-1 text-xs text-red-600">{errors.panel_member_ids}</p>}
        </fieldset>
        {conflicts && conflicts.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2" role="alert">
            <p className="font-semibold">Schedule conflict</p>
            <ul className="mt-1 list-disc pl-5">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn btn-secondary" onClick={checkAvailability} disabled={busy || !form.scheduled_at || panel.length === 0}>Check availability</button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || panel.length === 0}>{busy && <Spinner className="h-4 w-4" />} Schedule</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- evaluation form (HR: completeness/screening; Department Head: department evaluation) ----------
function EvaluationForm({ appId, role, onDone }) {
  const toast = useToast();
  const stages = role === 'department_head' ? [['department_head', 'Department Head evaluation']] : [['completeness', 'Document completeness'], ['screening', 'Screening']];
  const [form, setForm] = useState({ stage: stages[0][0], score: '', recommendation: 'proceed', comments: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.post(`/applications/${appId}/evaluations`, form);
      toast.success('Evaluation recorded');
      setForm({ stage: stages[0][0], score: '', recommendation: 'proceed', comments: '' });
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-3" noValidate>
      <SelectField label="Stage" value={form.stage} onChange={set('stage')}>
        {stages.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </SelectField>
      <TextField label="Score (0-100, optional)" type="number" min="0" max="100" step="0.5" value={form.score} onChange={set('score')} error={errors.score} />
      <SelectField label="Recommendation" value={form.recommendation} onChange={set('recommendation')}>
        <option value="proceed">Proceed</option>
        <option value="hold">Hold</option>
        <option value="reject">Reject</option>
      </SelectField>
      <TextAreaField className="sm:col-span-3" label="Comments" rows={3} value={form.comments} onChange={set('comments')} maxLength={2000} />
      <div className="sm:col-span-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Record evaluation</button>
      </div>
    </form>
  );
}

// ---------- interview feedback by a panel member ----------
function FeedbackForm({ interview, mine, onDone }) {
  const toast = useToast();
  const [score, setScore] = useState(mine.score ?? '');
  const [feedback, setFeedback] = useState(mine.feedback || '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/interviews/${interview.id}/feedback`, { score, feedback });
      toast.success('Feedback saved');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-4" noValidate>
      <TextField label="My score (0-100)" type="number" min="0" max="100" step="0.5" value={score} onChange={(e) => setScore(e.target.value)} />
      <TextAreaField className="sm:col-span-3" label="My feedback" rows={2} required value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} />
      <div className="sm:col-span-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || feedback.trim().length < 3}>{busy && <Spinner className="h-4 w-4" />} Save feedback</button>
      </div>
    </form>
  );
}

// ---------- the page ----------
export default function ApplicationReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const isHr = user.role === 'hr_officer';
  const { data: a, loading, error, reload } = useApi(`/applications/${id}`);
  const directory = useApi('/users/directory', undefined, { enabled: isHr });
  const [statusTo, setStatusTo] = useState(null);
  const [showInterview, setShowInterview] = useState(false);
  const [reviewerId, setReviewerId] = useState('');

  async function assign() {
    try {
      await api.post(`/applications/${id}/assignments`, { reviewer_id: Number(reviewerId) });
      toast.success('Department Head assigned');
      setReviewerId('');
      reload();
    } catch (err) { toast.error(errorMessage(err)); }
  }
  async function unassign(uid) {
    try {
      await api.delete(`/applications/${id}/assignments/${uid}`);
      toast.success('Assignment removed');
      reload();
    } catch (err) { toast.error(errorMessage(err)); }
  }

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const closed = TERMINAL_STATUSES.includes(a.status);
  const dir = directory.data || [];
  const assignedIds = (a.assignments || []).map((x) => x.reviewer_id);
  const assignable = dir.filter((u) => u.role === 'department_head' && !assignedIds.includes(u.id));
  const p = a.applicant;

  const actions = [
    ...(a.allowed_next_statuses || []).map((s) => (
      <button key={s} type="button" className={`btn btn-sm ${s === 'rejected' ? 'btn-danger' : 'btn-primary'}`} onClick={() => setStatusTo(s)}>
        {ACTION_LABELS[s]}
      </button>
    )),
    ...(isHr && a.status === 'shortlisted' ? [<button key="iv" type="button" className="btn btn-sm bg-accent-500 text-brand-900 hover:bg-accent-400" onClick={() => setShowInterview(true)}>Schedule interview</button>] : []),
  ];

  return (
    <>
      <PageHeader title={`Application ${a.application_no}`} subtitle={`${p.full_name} \u00b7 ${a.vacancy.title}`} actions={actions} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={a.status} />
        <span className="text-sm text-slate-500">Submitted {formatDateTime(a.submitted_at)}</span>
        <Link to="/portal/manage/applications" className="text-sm font-semibold">&larr; Back to list</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Applicant" />
            <dl className="grid gap-3 p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{p.full_name}</dd></div>
              {p.email && <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{p.email}</dd></div>}
              <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{p.phone || '-'}</dd></div>
              <div><dt className="text-slate-500">City</dt><dd className="font-medium">{p.city || '-'}</dd></div>
              <div><dt className="text-slate-500">Highest education</dt><dd className="font-medium">{p.highest_education || '-'}</dd></div>
              <div><dt className="text-slate-500">Field of study</dt><dd className="font-medium">{p.field_of_study || '-'}</dd></div>
              <div><dt className="text-slate-500">Years of experience</dt><dd className="font-medium">{p.years_experience ?? '-'}</dd></div>
              {p.summary && <div className="sm:col-span-2"><dt className="text-slate-500">Professional summary</dt><dd className="mt-1 whitespace-pre-line">{p.summary}</dd></div>}
              {a.cover_note && <div className="sm:col-span-2"><dt className="text-slate-500">Cover note</dt><dd className="mt-1 whitespace-pre-line">{a.cover_note}</dd></div>}
            </dl>
          </Card>

          <ProfileSections applicant={p} skillMatch={a.skill_match} />

          <Card>
            <CardHeader title="Documents" />
            <ul className="divide-y divide-slate-100">
              {a.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{d.type_name}</p>
                    <p className="truncate text-xs text-slate-500">{d.original_name} ({formatBytes(d.size_bytes)})</p>
                  </div>
                  <a className="btn btn-secondary btn-sm" href={`/api/documents/${d.id}/download`}>Download</a>
                </li>
              ))}
              {a.documents.length === 0 && <li className="px-5 py-3 text-sm text-slate-500">No documents on file.</li>}
            </ul>
            <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">Each download is recorded in the audit log.</p>
          </Card>

          <Card>
            <CardHeader title="Evaluations" />
            {a.evaluations.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No evaluations recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {a.evaluations.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <p className="font-semibold">{label(e.stage)} &middot; {label(e.recommendation)}{e.score !== null && e.score !== undefined ? ` \u00b7 ${e.score}` : ''}</p>
                    <p className="text-xs text-slate-500">{e.evaluator_name} &middot; {formatDateTime(e.created_at)}</p>
                    {e.comments && <p className="mt-1 whitespace-pre-line text-slate-700">{e.comments}</p>}
                  </li>
                ))}
              </ul>
            )}
            {!closed && <EvaluationForm appId={id} role={user.role} onDone={reload} />}
          </Card>

          <Card>
            <CardHeader title="Interviews" />
            {a.interviews.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No interviews yet.{isHr && a.status === 'shortlisted' ? ' Use "Schedule interview" above.' : ''}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {a.interviews.map((iv) => {
                  const mine = iv.panel.find((m) => m.user_id === user.id);
                  return (
                    <li key={iv.id} className="px-5 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{formatDateTime(iv.scheduled_at)} ({iv.duration_minutes || 45} min) &middot; {iv.location} ({label(iv.mode)})</p>
                        <StatusBadge status={iv.status} />
                      </div>
                      {iv.notes && <p className="mt-1 text-slate-600">{iv.notes}</p>}
                      <ul className="mt-2 space-y-1">
                        {iv.panel.map((m) => (
                          <li key={m.user_id} className="text-slate-700">
                            <span className="font-medium">{m.full_name}</span>
                            {m.submitted_at ? ` \u2014 score ${m.score ?? 'n/a'}: ${m.feedback}` : ' \u2014 feedback pending'}
                          </li>
                        ))}
                      </ul>
                      {mine && iv.status !== 'cancelled' && <FeedbackForm interview={iv} mine={mine} onDone={reload} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {isHr && (
            <Card>
              <CardHeader title="Department Head reviewers" />
              <ul className="divide-y divide-slate-100">
                {a.assignments.map((s) => (
                  <li key={s.reviewer_id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{s.full_name}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => unassign(s.reviewer_id)}>Remove</button>
                  </li>
                ))}
                {a.assignments.length === 0 && <li className="px-5 py-3 text-sm text-slate-500">Nobody assigned.</li>}
              </ul>
              <div className="border-t border-slate-200 p-4">
                <SelectField label="Assign Department Head" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                  <option value="">Select...</option>
                  {assignable.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </SelectField>
                <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={!reviewerId} onClick={assign}>Assign</button>
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Status history" />
            <Timeline items={a.history} />
          </Card>
        </div>
      </div>

      {statusTo && <StatusModal appId={id} to={statusTo} onClose={() => setStatusTo(null)} onDone={() => { setStatusTo(null); reload(); }} />}
      {showInterview && <InterviewModal appId={id} directory={dir} onClose={() => setShowInterview(false)} onDone={() => { setShowInterview(false); reload(); }} />}
    </>
  );
}
