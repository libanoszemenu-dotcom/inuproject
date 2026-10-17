import { useState } from 'react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/** Reminder shown to applicants whose email address is not verified yet. */
export default function VerifyBanner() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user || user.role !== 'applicant' || user.email_verified) return null;

  async function resend() {
    setBusy(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent. Check your inbox.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>Please verify your email address ({user.email}) to apply for vacancies. We sent you a link when you registered.</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={resend} disabled={busy}>Resend email</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => refresh().catch(() => {})}>I have verified</button>
      </div>
    </div>
  );
}
