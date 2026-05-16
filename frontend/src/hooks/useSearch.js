import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export function useSearch(query, delay = 300) {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/search', { params: { q: query, limit: 8 } });
        setResults(data.results);
      } catch (err) {
        console.error('Error en búsqueda:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => clearTimeout(debounceRef.current);
  }, [query, delay]);

  return { results, loading };
}
