import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import {
  Card, ErrorState, PageHeader, PageLoader, SelectField, Spinner, TextAreaField, TextField,
} from '../../components/ui';
import { toInputDateTime } from '../../utils/format';

const EMPTY = {
  title: '', department_id: '', category: 'academic', employment_type: 'full_time', description: '',
  qualifications: '', positions_count: 1, location: '', deadline_at: '', required_document_codes: ['cv'], required_skills: [],
};

export default function VacancyForm() {
  const { id } = useParams(); // present when editing
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const lookups = useApi('/meta/lookups');
  const existing = useApi(`/vacancies/${id}`, undefined, { enabled: editing });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const v = existing.data;
    if (!v) return;
    setForm({
      title: v.title, department_id: v.department_id, category: v.category, employment_type: v.employment_type,
      description: v.description, qualifications: v.qualifications, positions_count: v.positions_count,
      location: v.location, deadline_at: toInputDateTime(v.deadline_at),
      required_document_codes: v.required_documents.map((d) => d.code),
      required_skills: v.required_skills || [],
    });
  }, [existing.data]);

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));
  const toggleDoc = (code) => setForm((s) => ({
    ...s,
    required_document_codes: s.required_document_codes.includes(code)
      ? s.required_document_codes.filter((c) => c !== code)
      : [...s.required_document_codes, code],
  }));

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError('');
    const payload = { ...form, department_id: Number(form.department_id), positions_count: Number(form.positions_count) };
    try {
      if (editing) {
        await api.put(`/vacancies/${id}`, payload);
        toast.success('Vacancy updated');
        navigate(`/portal/manage/vacancies/${id}`);
      } else {
        const res = await api.post('/vacancies', payload);
        toast.success('Vacancy saved as draft');
        navigate(`/portal/manage/vacancies/${res.data.data.id}`);
      }
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (lookups.loading || (editing && existing.loading)) return <PageLoader />;
  if (lookups.error) return <ErrorState message={lookups.error} onRetry={lookups.reload} />;
  if (editing && existing.error) return <ErrorState message={existing.error} onRetry={existing.reload} />;
  if (editing && existing.data.status !== 'draft') {
    return (
      <Card className="p-6">
        <p className="font-semibold">Only draft vacancies can be edited.</p>
        <Link to={`/portal/manage/vacancies/${id}`} className="btn btn-secondary mt-4">Back</Link>
      </Card>
    );
  }

  const { departments, document_types: docTypes } = lookups.data;

  return (
    <>
      <PageHeader title={editing ? 'Edit vacancy' : 'New vacancy'} subtitle="Vacancies are saved as drafts. Submit them from the vacancy page when ready." />
      <form onSubmit={onSubmit} noValidate>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <TextField className="sm:col-span-2" label="Job title" required value={form.title} onChange={set('title')} error={errors.title} />
          <SelectField label="Department / unit" required value={form.department_id} onChange={set('department_id')} error={errors.department_id}>
            <option value="">Select...</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <TextField label="Workplace location" required value={form.location} onChange={set('location')} error={errors.location} />
          <SelectField label="Category" value={form.category} onChange={set('category')} error={errors.category}>
            <option value="academic">Academic</option>
            <option value="administrative">Administrative</option>
            <option value="technical">Technical</option>
          </SelectField>
          <SelectField label="Employment type" value={form.employment_type} onChange={set('employment_type')} error={errors.employment_type}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
          </SelectField>
          <TextField label="Number of positions" type="number" min="1" max="100" required value={form.positions_count} onChange={set('positions_count')} error={errors.positions_count} />
          <TextField label="Application deadline" type="datetime-local" required value={form.deadline_at} onChange={set('deadline_at')} error={errors.deadline_at} />
          <TextAreaField className="sm:col-span-2" label="Job description" required rows={6} value={form.description} onChange={set('description')} error={errors.description} />
          <TextField
            className="sm:col-span-2" label="Required skills (comma separated)"
            value={form.required_skills.join(', ')}
            onChange={(e) => setForm((s) => ({ ...s, required_skills: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))}
            error={Object.entries(errors).find(([k]) => k.startsWith('required_skills'))?.[1]}
            hint="Example: Python, SQL, Teaching. Shown to applicants and used to help reviewers compare profiles."
          />
          <TextAreaField className="sm:col-span-2" label="Qualifications and requirements" required rows={5} value={form.qualifications} onChange={set('qualifications')} error={errors.qualifications} />
          <fieldset className="sm:col-span-2">
            <legend className="label">Required documents <span className="text-red-600" aria-hidden="true">*</span></legend>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
              {docTypes.map((d) => (
                <label key={d.code} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.required_document_codes.includes(d.code)} onChange={() => toggleDoc(d.code)} />
                  {d.name}
                </label>
              ))}
            </div>
            {errors.required_document_codes && <p className="mt-1 text-xs text-red-600">{errors.required_document_codes}</p>}
          </fieldset>
        </Card>

        {formError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}
        <div className="mt-6 flex gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} {editing ? 'Save changes' : 'Save as draft'}</button>
          <Link to={editing ? `/portal/manage/vacancies/${id}` : '/portal/manage/vacancies'} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  );
}
