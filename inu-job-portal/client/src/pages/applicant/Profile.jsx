import { useEffect, useRef, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import {
  Card, CardHeader, ErrorState, PageHeader, PageLoader, Progress, SelectField, Spinner, TextAreaField, TextField,
} from '../../components/ui';

const EMPTY = {
  full_name: '', phone: '', date_of_birth: '', city: '', highest_education: '', field_of_study: '', years_experience: '', summary: '',
};
const EMPTY_EDU = { institution: '', degree_level: '', field_of_study: '', start_year: '', end_year: '' };
const EMPTY_EXP = { employer: '', job_title: '', start_date: '', end_date: '', is_current: false, description: '' };
const LEVELS = ['Certificate', 'Diploma', "Bachelor's degree", "Master's degree", 'PhD', 'Other'];

const toEdu = (e) => ({ institution: e.institution || '', degree_level: e.degree_level || '', field_of_study: e.field_of_study || '', start_year: e.start_year ?? '', end_year: e.end_year ?? '' });
const toExp = (e) => ({
  employer: e.employer || '', job_title: e.job_title || '', start_date: e.start_date ? String(e.start_date).slice(0, 10) : '',
  end_date: e.end_date ? String(e.end_date).slice(0, 10) : '', is_current: Boolean(e.is_current), description: e.description || '',
});

/** Server errors come as "education.0.institution": pick the ones for one row. */
const rowErrors = (errors, list, i) => Object.fromEntries(
  Object.entries(errors).filter(([k]) => k.startsWith(`${list}.${i}.`)).map(([k, v]) => [k.split('.').pop(), v])
);

// ---------- CV upload and parsing ----------
function CvImport({ onApply }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('resume', file);
      const res = await api.post('/profile/resume/parse', body);
      setResult(res.data.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title="Import from your CV" />
      <div className="p-5 text-sm">
        <p className="text-slate-600">
          Upload a text-based PDF or Word (.docx) CV and we will suggest your education, experience and skills. Nothing is saved until you
          review the suggestions and press <strong>Save profile</strong>. The file itself is not stored.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" id="cv-file" className="sr-only" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={upload} disabled={busy} />
          <label htmlFor="cv-file" className={`btn btn-secondary ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
            {busy && <Spinner className="h-4 w-4" />} {busy ? 'Reading your CV...' : 'Choose CV file'}
          </label>
        </div>
        {result && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4" role="status">
            <p className="font-semibold">
              Found {result.education.length} education, {result.experience.length} experience and {result.skills.length} skill entries.
            </p>
            {result.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { onApply(result); setResult(null); toast.success('Suggestions added below. Please review them and save.'); }}>
                Add suggestions to my profile
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResult(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Profile() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/profile');
  const [form, setForm] = useState(EMPTY);
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!data) return;
    setPercent(data.completion_percent);
    setForm({
      full_name: data.full_name || '', phone: data.phone || '',
      date_of_birth: data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
      city: data.city || '', highest_education: data.highest_education || '', field_of_study: data.field_of_study || '',
      years_experience: data.years_experience ?? '', summary: data.summary || '',
    });
    setEducation((data.education || []).map(toEdu));
    setExperience((data.experience || []).map(toExp));
    setSkills(data.skills || []);
  }, [data]);

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));
  const patchRow = (setter) => (i, field, value) => setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const patchEdu = patchRow(setEducation);
  const patchExp = patchRow(setExperience);

  function addSkill() {
    const parts = skillInput.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => s.length >= 2);
    setSkills((cur) => {
      const have = new Set(cur.map((s) => s.toLowerCase()));
      return [...cur, ...parts.filter((s) => !have.has(s.toLowerCase()) && have.add(s.toLowerCase()))].slice(0, 40);
    });
    setSkillInput('');
  }

  /** Merge CV suggestions without overwriting what the applicant already typed. */
  function applySuggestions(r) {
    setForm((f) => ({
      ...f,
      phone: f.phone || r.phone || '',
      summary: f.summary || r.summary || '',
      highest_education: f.highest_education || r.highest_education || '',
      field_of_study: f.field_of_study || r.field_of_study || '',
      years_experience: f.years_experience === '' && r.years_experience !== null ? r.years_experience : f.years_experience,
    }));
    setEducation((cur) => [...cur, ...r.education.map(toEdu)].slice(0, 10));
    setExperience((cur) => [...cur, ...r.experience.map(toExp)].slice(0, 15));
    setSkills((cur) => {
      const have = new Set(cur.map((s) => s.toLowerCase()));
      return [...cur, ...r.skills.filter((s) => !have.has(s.toLowerCase()))].slice(0, 40);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const payload = {
        ...form,
        education: education.map((x) => ({ ...x, start_year: x.start_year === '' ? null : Number(x.start_year), end_year: x.end_year === '' ? null : Number(x.end_year) })),
        experience: experience.map((x) => ({ ...x, end_date: x.is_current ? '' : x.end_date })),
        skills,
      };
      const res = await api.put('/profile', payload);
      setPercent(res.data.data.completion_percent);
      toast.success('Profile saved');
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="My profile" subtitle="Keep only the information that is needed for your applications." />
      <Card className="mb-6 p-5">
        <p className="mb-2 text-sm font-semibold">Profile completion: {percent}%</p>
        <Progress percent={percent} />
      </Card>

      <CvImport onApply={applySuggestions} />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <Card>
          <CardHeader title="Personal and summary" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <TextField label="Full name" required value={form.full_name} onChange={set('full_name')} error={errors.full_name} />
            <TextField label="Phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
            <TextField label="Date of birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} error={errors.date_of_birth} />
            <TextField label="City" value={form.city} onChange={set('city')} error={errors.city} />
            <SelectField label="Highest education" value={form.highest_education} onChange={set('highest_education')} error={errors.highest_education}>
              <option value="">Select...</option>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </SelectField>
            <TextField label="Field of study" value={form.field_of_study} onChange={set('field_of_study')} error={errors.field_of_study} />
            <TextField label="Years of experience" type="number" min="0" max="60" value={form.years_experience} onChange={set('years_experience')} error={errors.years_experience} />
            <div className="sm:col-span-2">
              <TextAreaField label="Professional summary" rows={4} value={form.summary} onChange={set('summary')} error={errors.summary} hint="Up to 2000 characters." />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Education" action={education.length < 10 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEducation((r) => [...r, { ...EMPTY_EDU }])}>Add education</button>} />
          <div className="divide-y divide-slate-100">
            {education.length === 0 && <p className="p-5 text-sm text-slate-500">No education added yet.</p>}
            {education.map((row, i) => {
              const er = rowErrors(errors, 'education', i);
              return (
                <div key={i} className="grid gap-4 p-5 sm:grid-cols-2">
                  <TextField className="sm:col-span-2" label="Institution" required value={row.institution} onChange={(e) => patchEdu(i, 'institution', e.target.value)} error={er.institution} />
                  <SelectField label="Level" value={row.degree_level} onChange={(e) => patchEdu(i, 'degree_level', e.target.value)} error={er.degree_level}>
                    <option value="">Select...</option>
                    {LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </SelectField>
                  <TextField label="Field of study" value={row.field_of_study} onChange={(e) => patchEdu(i, 'field_of_study', e.target.value)} error={er.field_of_study} />
                  <TextField label="Start year" type="number" min="1950" max="2100" value={row.start_year} onChange={(e) => patchEdu(i, 'start_year', e.target.value)} error={er.start_year} />
                  <TextField label="End year" type="number" min="1950" max="2100" value={row.end_year} onChange={(e) => patchEdu(i, 'end_year', e.target.value)} error={er.end_year} />
                  <div className="sm:col-span-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEducation((r) => r.filter((_, idx) => idx !== i))}>Remove this entry</button></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Work experience" action={experience.length < 15 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExperience((r) => [...r, { ...EMPTY_EXP }])}>Add experience</button>} />
          <div className="divide-y divide-slate-100">
            {experience.length === 0 && <p className="p-5 text-sm text-slate-500">No work experience added yet.</p>}
            {experience.map((row, i) => {
              const er = rowErrors(errors, 'experience', i);
              return (
                <div key={i} className="grid gap-4 p-5 sm:grid-cols-2">
                  <TextField label="Job title" required value={row.job_title} onChange={(e) => patchExp(i, 'job_title', e.target.value)} error={er.job_title} />
                  <TextField label="Employer" required value={row.employer} onChange={(e) => patchExp(i, 'employer', e.target.value)} error={er.employer} />
                  <TextField label="Start date" type="date" required value={row.start_date} onChange={(e) => patchExp(i, 'start_date', e.target.value)} error={er.start_date} />
                  <TextField label="End date" type="date" value={row.is_current ? '' : row.end_date} disabled={row.is_current} onChange={(e) => patchExp(i, 'end_date', e.target.value)} error={er.end_date} />
                  <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={row.is_current} onChange={(e) => patchExp(i, 'is_current', e.target.checked)} /> I currently work here
                  </label>
                  <TextAreaField className="sm:col-span-2" label="Responsibilities (optional)" rows={3} value={row.description} onChange={(e) => patchExp(i, 'description', e.target.value)} maxLength={1500} error={er.description} />
                  <div className="sm:col-span-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setExperience((r) => r.filter((_, idx) => idx !== i))}>Remove this entry</button></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Skills" />
          <div className="p-5">
            <ul className="mb-4 flex flex-wrap gap-2">
              {skills.length === 0 && <li className="text-sm text-slate-500">No skills added yet.</li>}
              {skills.map((s) => (
                <li key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-medium text-slate-700">
                  {s}
                  <button type="button" className="rounded-full px-2 text-slate-500 hover:bg-slate-200" aria-label={`Remove ${s}`} onClick={() => setSkills((cur) => cur.filter((x) => x !== s))}>&times;</button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-3">
              <TextField className="min-w-64 flex-1" label="Add skills (comma separated)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} error={errors.skills} />
              <button type="button" className="btn btn-secondary" onClick={addSkill} disabled={skillInput.trim().length < 2}>Add</button>
            </div>
          </div>
        </Card>

        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save profile</button>
        </div>
      </form>
    </>
  );
}
