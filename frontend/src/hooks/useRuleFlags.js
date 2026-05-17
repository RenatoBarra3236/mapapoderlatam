import { useEffect, useState } from 'react';
import { fetchFlags } from '../services/api';

// Loads rule-based flags from /api/flags. Deterministic detector (no AI),
// so it's fast (~ms). Falls back to empty array on error.

export function useRuleFlags(caseId, lang) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!caseId) { setState({ loading: false }); return; }
    let cancelled = false;
    setState({ loading: true });

    fetchFlags(caseId, lang)
      .then(data => {
        if (cancelled) return;
        setState({ loading: false, flags: data.flags || [] });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ loading: false, error: err.message, flags: [] });
      });

    return () => { cancelled = true; };
  }, [caseId, lang]);

  return state;
}
