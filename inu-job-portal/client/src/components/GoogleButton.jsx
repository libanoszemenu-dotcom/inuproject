import { useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    const script = existing || Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true, defer: true });
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Google script blocked')), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

/** "Sign in with Google" button. Hidden automatically when the server has no GOOGLE_CLIENT_ID. */
export default function GoogleButton({ onSuccess, label = 'Continue with Google' }) {
  const { loginWithGoogle } = useAuth();
  const holder = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api.get('/auth/config').then((r) => { if (!ignore) setClientId(r.data.data.google_client_id); }).catch(() => {});
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!clientId || !holder.current) return undefined;
    let ignore = false;
    loadScript()
      .then(() => {
        if (ignore || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            setError('');
            try {
              await loginWithGoogle(response.credential);
              onSuccess?.();
            } catch (err) {
              setError(errorMessage(err));
            }
          },
        });
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'outline', size: 'large', width: 320, text: label.startsWith('Sign up') ? 'signup_with' : 'continue_with',
        });
      })
      .catch(() => setError('Google sign-in could not be loaded. Use your email and password instead.'));
    return () => { ignore = true; };
  }, [clientId, loginWithGoogle, onSuccess, label]);

  if (!clientId) return null;
  return (
    <div className="mt-5">
      <div className="relative my-4 text-center text-xs text-slate-500">
        <span className="relative z-10 bg-white px-3">or</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" aria-hidden="true" />
      </div>
      <div ref={holder} className="flex justify-center" />
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}
