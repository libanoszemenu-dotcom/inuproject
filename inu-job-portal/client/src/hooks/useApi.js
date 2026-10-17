import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';

/** Remove empty values so the server never receives "category=" etc. */
function clean(params) {
  return Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}

/**
 * GET data from the API and track loading / error state.
 *   const { data, meta, loading, error, reload } = useApi('/vacancies', { page: 1 });
 * Pass { enabled: false } as the third argument to wait before loading.
 */
export default function useApi(url, params, options = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(clean(params));
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    let ignore = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(url, { params: JSON.parse(key) })
      .then((res) => {
        if (!ignore) setState({ data: res.data.data, meta: res.data.meta || null, loading: false, error: null });
      })
      .catch((err) => {
        if (!ignore) setState({ data: null, meta: null, loading: false, error: errorMessage(err) });
      });
    return () => { ignore = true; };
  }, [url, key, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
