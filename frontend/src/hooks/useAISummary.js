import { useEffect, useState } from 'react';
import { fetchSummary } from '../services/api';

// Loads { summary, flags } from /api/ai/summary on every caseId or lang change.
// While loading, returns { loading: true }. On error, returns { error } and
// callers can fall back to demoData. The summary text in `flags[].title` is a
// plain string (not the {es, en} shape the demo uses) — the AI generates them
// in the requested language already, so the UI should not index by [lang].

export function useAISummary(caseId, lang) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!caseId) { setState({ loading: false }); return; }
    let cancelled = false;
    setState({ loading: true });

    fetchSummary(caseId, lang)
      .then(data => {
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
