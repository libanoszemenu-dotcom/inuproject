import axios from 'axios';

// All requests go to /api (proxied to the Express server in development).
const api = axios.create({ baseURL: '/api' });

// If the server says "not logged in" on a normal request, tell the app so it can show the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/register') || url.startsWith('/auth/google') || url.startsWith('/auth/me');
    if (error.response?.status === 401 && !isAuthCall) window.dispatchEvent(new Event('auth:expired'));
    return Promise.reject(error);
  }
);

/** One readable message for any failed request. */
export function errorMessage(err) {
  const d = err?.response?.data;
  if (d?.errors?.length) return `${d.message}: ${d.errors.map((e) => e.message).join('; ')}`;
  if (d?.message) return d.message;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?';
  return 'Something went wrong. Please try again.';
}

/** Map of field name -> message, for showing errors next to form inputs. */
export function fieldErrors(err) {
  const out = {};
  (err?.response?.data?.errors || []).forEach((e) => {
    if (e.field && !out[e.field]) out[e.field] = e.message;
  });
  return out;
}

export default api;
