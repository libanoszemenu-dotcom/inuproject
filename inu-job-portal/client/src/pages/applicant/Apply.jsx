import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Card, ErrorState, PageHeader, PageLoader, Spinner, TextAreaField } from '../../components/ui';
import { formatBytes, formatDateTime } from '../../utils/format';

const MAX_MB = 5;
const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function Apply() {
  const { vacancyId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: v, loading, error, reload } = useApi(`/vacancies/${vacancyId}`);
  const [coverNote, setCoverNote] = useState('');
  const [files, setFiles] = useState({}); // { documentCode: File }
  const [fileErrors, setFileErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (v.my_application) {
    return (
      <Card className="p-6">
        <p className="font-semibold">You have already applied for this vacancy.</p>
        <Link to={`/portal/applications/${v.my_application.id}`} className="btn btn-primary mt-4">View my application</Link>
      </Card>
    );
  }
  if (!v.is_open) {
    return (
      <Card className="p-6">
        <p className="font-semibold">This vacancy is not open for applications.</p>
        <Link to="/vacancies" className="btn btn-secondary mt-4">Browse vacancies</Link>
      </Card>
    );
  }

  function pick(code, file) {
    let message = '';
    if (file) {
      if (!OK_TYPES.includes(file.type)) message = 'Only PDF, JPEG or PNG files are allowed';
      else if (file.size > MAX_MB * 1024 * 1024) message = `File is larger than ${MAX_MB} MB`;
    }
    setFileErrors((e) => ({ ...e, [code]: message }));
    setFiles((f) => {
      const next = { ...f };
      if (file && !message) next[code] = file; else delete next[code];
      return next;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const missing = v.required_documents.filter((d) => d.is_mandatory && !files[d.code]);
    if (missing.length) {
      setFileErrors((fe) => ({ ...fe, ...Object.fromEntries(missing.map((d) => [d.code, `${d.name} is required`])) }));
      setFormError('Please attach all required documents.');
      return;
    }
    const fd = new FormData();
    fd.append('vacancy_id', v.id);
    if (coverNote.trim()) fd.append('cover_note', coverNote.trim());
    Object.entries(files).forEach(([code, file]) => fd.append(code, file)); // field name = document type code

    setBusy(true);
    try {
      const res = await api.post('/applications', fd);
      toast.success('Application submitted successfully');
      navigate(`/portal/applications/${res.data.data.id}`, { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={`Apply: ${v.title}`} subtitle={`${v.department} \u00b7 Deadline ${formatDateTime(v.deadline_at)}`} />
      <form onSubmit={onSubmit} noValidate>
        <Card className="p-5">
          <h2 className="text-base font-semibold">Required documents</h2>
          <p className="mt-1 text-sm text-slate-600">PDF, JPEG or PNG, up to {MAX_MB} MB each. Files are stored privately and only authorized recruitment staff can open them.</p>
          <div className="mt-4 space-y-4">
            {v.required_documents.map((d) => {
              const inputId = `doc-${d.code}`;
              return (
                <div key={d.code}>
                  <label htmlFor={inputId} className="label">
                    {d.name} {d.is_mandatory ? <span className="text-red-600" aria-hidden="true">*</span> : <span className="text-slate-500">(optional)</span>}
                  </label>
                  <input
                    id={inputId}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100"
                    aria-invalid={Boolean(fileErrors[d.code])}
                    onChange={(e) => pick(d.code, e.target.files[0])}
                  />
                  {files[d.code] && <p className="mt-1 text-xs text-slate-500">{files[d.code].name} ({formatBytes(files[d.code].size)})</p>}
                  {fileErrors[d.code] && <p className="mt-1 text-xs text-red-600">{fileErrors[d.code]}</p>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="mt-6 p-5">
          <TextAreaField label="Cover note (optional)" rows={5} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} hint="Up to 3000 characters." maxLength={3000} />
        </Card>

        {formError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}

        <div className="mt-6 flex gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Submit application</button>
          <Link to={`/vacancies/${v.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">You can apply only once for each vacancy.</p>
      </form>
    </>
  );
}
