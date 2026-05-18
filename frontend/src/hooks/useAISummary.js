import { useEffect, useState } from 'react';
import { fetchSummary } from '../services/api';

// Module-level cache keyed by `${caseId}:${lang}`. Survives component
// remounts and tab navigations, so toggling between cases or coming back to
// a previously-loaded one never triggers a second API call. The backend has
// its own cache too — this one saves the round-trip and keeps the UI snappy.
const summaryCache = new Map();

export function useAISummary(caseId, lang) {
  const cacheKey = caseId ? `${caseId}:${lang}` : null;
  const [state, setState] = useState(() => {
    if (cacheKey && summaryCache.has(cacheKey)) {
      return { loading: false, data: summaryCache.get(cacheKey) };
    }
    return { loading: true };
  });

  useEffect(() => {
    if (!caseId) { setState({ loading: false }); return; }
    const key = `${caseId}:${lang}`;
    if (summaryCache.has(key)) {
      setState({ loading: false, data: summaryCache.get(key) });
      return;
    }
    let cancelled = false;
    setState({ loading: true });

    fetchSummary(caseId, lang)
      .then(data => {
        // Cache BEFORE the cancelled check: even if the user navigated away
        // while the request was in flight, the response is still valid for
        // the next visit to this case. Without this, fast switching A → B → A
        // would trigger a second API call instead of reusing A's result.
        summaryCache.set(key, data);
        if (cancelled) return;
        setState({ loading: false, data });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [caseId, lang]);

  return state;
}
