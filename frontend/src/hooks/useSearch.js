import { useState, useEffect, useRef } from 'react';

export function useSearch(query, delay = 300) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      try {
        // Buscar en los datos mockeados (window.DEMO_CASES)
        if (!window.DEMO_CASES) {
          setResults([]);
          return;
        }

        const searchResults = [];
        const queryLower = query.toLowerCase();

        // Iterar sobre todos los casos
        Object.values(window.DEMO_CASES).forEach((caseData) => {
          // Buscar en nodos
          if (caseData.nodes) {
            caseData.nodes.forEach((node) => {
              if (
                node.name.toLowerCase().includes(queryLower) ||
                (node.subtitle && node.subtitle.toLowerCase().includes(queryLower))
              ) {
                // Evitar duplicados
                if (!searchResults.find((r) => r.id === node.id)) {
                  searchResults.push({
                    ...node,
                    caseId: caseData.id,
                  });
                }
              }
            });
          }
        });

        // Limitar a 8 resultados
        setResults(searchResults.slice(0, 8));
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
