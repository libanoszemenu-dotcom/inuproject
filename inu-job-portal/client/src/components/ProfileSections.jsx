import { Card, CardHeader } from './ui';

const ym = (d) => (d ? String(d).slice(0, 7) : '');

/** Read-only view of an applicant's education, experience and skills (used by reviewers). */
export default function ProfileSections({ applicant, skillMatch }) {
  const { education = [], experience = [], skills = [] } = applicant;
  return (
    <>
      <Card>
        <CardHeader title="Education" />
        {education.length === 0 ? <p className="p-5 text-sm text-slate-500">No education entries.</p> : (
          <ul className="divide-y divide-slate-100">
            {education.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <p className="font-semibold">{[e.degree_level, e.field_of_study].filter(Boolean).join(' in ') || 'Qualification'}</p>
                <p className="text-slate-600">{e.institution}{(e.start_year || e.end_year) ? ` \u00b7 ${e.start_year || ''}${e.start_year && e.end_year ? '\u2013' : ''}${e.end_year || ''}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Work experience" />
        {experience.length === 0 ? <p className="p-5 text-sm text-slate-500">No experience entries.</p> : (
          <ul className="divide-y divide-slate-100">
            {experience.map((x) => (
              <li key={x.id} className="px-5 py-3 text-sm">
                <p className="font-semibold">{x.job_title} <span className="font-normal text-slate-600">at {x.employer}</span></p>
                <p className="text-xs text-slate-500">{ym(x.start_date)} \u2013 {x.is_current ? 'Present' : ym(x.end_date)}</p>
                {x.description && <p className="mt-1 whitespace-pre-line text-slate-700">{x.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Skills" />
        <div className="p-5 text-sm">
          {skills.length === 0 ? <p className="text-slate-500">No skills listed.</p> : (
            <ul className="flex flex-wrap gap-2">
              {skills.map((s) => <li key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{s}</li>)}
            </ul>
          )}
          {skillMatch && skillMatch.required.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="font-semibold">Required for this vacancy</p>
              <p className="mt-1 text-xs text-slate-500">For information only: the reviewer decides.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {skillMatch.matched.map((s) => <li key={s} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{'\u2713'} {s}</li>)}
                {skillMatch.missing.map((s) => <li key={s} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{'\u2717'} {s}</li>)}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
