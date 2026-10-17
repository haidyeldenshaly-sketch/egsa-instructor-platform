import { useCallback, useEffect, useRef, useState } from 'react';
export default function useFetch(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, error: null, loading: enabled });
  const alive = useRef(true);
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await fn();
      const isEnvelope = r && typeof r === 'object' && 'success' in r && 'data' in r;
      if (alive.current) setState({ data: isEnvelope ? r.data : r, meta: isEnvelope ? r.meta || null : null, error: null, loading: false });
    } catch (e) { if (alive.current) setState({ data: null, meta: null, error: e, loading: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { alive.current = true; if (enabled) run(); return () => { alive.current = false; }; }, [run, enabled]);
  return { ...state, reload: run };
}
