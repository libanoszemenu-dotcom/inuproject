import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Modal, PageHeader, PageLoader, SelectField, Spinner, TextAreaField } from '../../components/ui';
import { PIPELINE_COLUMNS, formatDate, statusLabel } from '../../utils/format';

// Moves a person can make from the board (interview steps are done through the interview manager).
const HR_MOVES = {
  submitted: ['under_review', 'rejected'], under_review: ['screened', 'rejected'], screened: ['shortlisted', 'rejected'],
  shortlisted: ['rejected'], interview_scheduled: ['rejected'], interview_completed: ['selected', 'rejected'],
};
const DH_MOVES = {
  under_review: ['screened', 'rejected'], screened: ['shortlisted', 'rejected'], shortlisted: ['rejected'],
  interview_scheduled: ['rejected'], interview_completed: ['selected', 'rejected'],
};

function MoveModal({ card, moves, onClose, onDone }) {
  const toast = useToast();
  const [to, setTo] = useState(moves[0]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const needsReason = to === 'rejected';

  async function submit() {
    if (needsReason && reason.trim().length < 5) { toast.error('A reason of at least 5 characters is required'); return; }
    setBusy(true);
    try {
      await api.post(`/applications/${card.id}/status`, { to_status: to, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      toast.success(`${card.applicant_name}: ${statusLabel(to)}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Move ${card.application_no}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`btn ${needsReason ? 'btn-danger' : 'btn-primary'}`} onClick={submit} disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Move</button>
      </>}>
      <p className="mb-3 text-sm text-slate-700">{card.applicant_name} &middot; {card.vacancy_title}. The applicant will be notified.</p>
      <SelectField label="New stage" value={to} onChange={(e) => setTo(e.target.value)}>
        {moves.map((m) => <option key={m} value={m}>{statusLabel(m)}</option>)}
      </SelectField>
      <div className="mt-3">
        <TextAreaField label={needsReason ? 'Reason (shown to the applicant)' : 'Note (optional)'} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required={needsReason} />
      </div>
    </Modal>
  );
}

/** Kanban-style board: one column per pipeline stage. */
export default function Pipeline() {
  const { user } = useAuth();
  const [vacancyId, setVacancyId] = useState('');
  const { data, loading, error, reload } = useApi('/applications', { page: 1, page_size: 100, vacancy_id: vacancyId });
  const vacancies = useApi('/vacancies/manage/list', { page_size: 100 }, { enabled: user.role === 'hr_officer' });
  const [moving, setMoving] = useState(null);
  const moveMap = user.role === 'hr_officer' ? HR_MOVES : DH_MOVES;

  return (
    <>
      <PageHeader title="Application pipeline" subtitle="Applied \u2192 Under review \u2192 Shortlisted \u2192 Interview \u2192 Selected / Not selected." />
      {user.role === 'hr_officer' && (
        <div className="mb-4 max-w-sm">
          <SelectField label="Vacancy" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)}>
            <option value="">All vacancies</option>
            {(vacancies.data || []).map((v) => <option key={v.id} value={v.id}>{v.reference_no} - {v.title}</option>)}
          </SelectField>
        </div>
      )}
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map(([status, title]) => {
              const cards = data.filter((a) => a.status === status);
              return (
                <section key={status} className="w-72 shrink-0 rounded-xl bg-slate-100 p-3" aria-label={title}>
                  <h2 className="mb-3 flex items-center justify-between text-sm font-bold text-slate-800">
                    {title}<span className="rounded-full bg-white px-2 py-0.5 text-xs">{cards.length}</span>
                  </h2>
                  <ul className="space-y-3">
                    {cards.map((a) => (
                      <li key={a.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                        <Link to={`/portal/manage/applications/${a.id}`} className="font-semibold">{a.applicant_name}</Link>
                        <p className="text-xs text-slate-500">{a.application_no} &middot; {formatDate(a.submitted_at)}</p>
                        <p className="mt-1 text-slate-700">{a.vacancy_title}</p>
                        {(moveMap[status] || []).length > 0 && (
                          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setMoving(a)}>Move</button>
                        )}
                      </li>
                    ))}
                    {cards.length === 0 && <li className="text-xs text-slate-500">Empty</li>}
                  </ul>
                </section>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">The board shows the 100 most recent applications. Interviews are scheduled from a shortlisted application.</p>
        </>
      )}
      {moving && <MoveModal card={moving} moves={moveMap[moving.status]} onClose={() => setMoving(null)} onDone={() => { setMoving(null); reload(); }} />}
    </>
  );
}
