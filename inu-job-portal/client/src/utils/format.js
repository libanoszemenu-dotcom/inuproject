const LABELS = {
  // application statuses
  submitted: 'Applied', under_review: 'Under review', screened: 'Screened', shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview scheduled', interview_completed: 'Interview completed',
  selected: 'Selected', rejected: 'Not selected', withdrawn: 'Withdrawn',
  // vacancy statuses
  draft: 'Draft', pending_approval: 'Pending approval', published: 'Published', closed: 'Closed', cancelled: 'Cancelled',
  // interview statuses
  scheduled: 'Scheduled', completed: 'Completed',
};

export const ROLE_LABELS = {
  admin: 'System Administrator',
  hr_officer: 'HR / Recruitment Officer',
  department_head: 'Department Head',
  applicant: 'Applicant',
};

/** The pipeline: Applied -> Under review -> Shortlisted -> Interview -> Selected / Not selected. */
export const PIPELINE_COLUMNS = [
  ['submitted', 'Applied'],
  ['under_review', 'Under review'],
  ['screened', 'Screened'],
  ['shortlisted', 'Shortlisted'],
  ['interview_scheduled', 'Interview scheduled'],
  ['interview_completed', 'Interview done'],
  ['selected', 'Selected'],
  ['rejected', 'Not selected'],
];

export const label = (s) =>
  s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

export const statusLabel = (s) => LABELS[s] || label(s);

/** The API returns "YYYY-MM-DD HH:MM:SS" strings; show them as-is without timezone conversion. */
export const formatDateTime = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '-');
export const formatDate = (s) => (s ? String(s).slice(0, 10) : '-');
/** For <input type="datetime-local"> */
export const toInputDateTime = (s) => (s ? String(s).slice(0, 16).replace(' ', 'T') : '');

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const TERMINAL_STATUSES = ['selected', 'rejected', 'withdrawn'];
