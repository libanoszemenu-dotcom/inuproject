import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refresh } = useAuth();
  const [state, setState] = useState({ loading: true, ok: false, message: '' });
  
  // 💡 ይህቺ ናት ጥያቄው ሁለት ጊዜ እንዳይላክ የምትቆልፈው
  const hasRequested = useRef(false);

  useEffect(() => {
    if (!token) { 
      setState({ loading: false, ok: false, message: 'This link is incomplete.' }); 
      return; 
    }

    if (hasRequested.current) return;
    hasRequested.current = true;

    api.post('/auth/verify-email', { token })
      .then(() => {
        setState({ loading: false, ok: true, message: '' });
        if (user) refresh().catch(() => {});
      })
      .catch((err) => {
        setState({ loading: false, ok: false, message: errorMessage(err) });
      });
  }, [token, user, refresh]);

  if (state.loading) return <PageLoader label="Verifying your email..." />;
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-bold">{state.ok ? 'Email verified' : 'Verification failed'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {state.ok ? 'Thank you. You can now apply for vacancies at Injibara University.' : state.message}
        </p>
        <Link to={user ? '/portal' : '/login'} className="btn btn-primary mt-6">
          {user ? 'Go to my portal' : 'Log in'}
        </Link>
      </div>
    </div>
  );
}