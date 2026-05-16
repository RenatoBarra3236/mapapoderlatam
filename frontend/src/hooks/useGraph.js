import { useState, useCallback } from 'react';
import api from '../services/api';

export function useGraph() {
  const [graphData, setGraphData] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const loadGraph = useCallback(async (nodeId, depth = 2) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/graph/${nodeId}`, { params: { depth } });
      setGraphData(data);
    } catch (err) {
      setError('No se pudo cargar la red de conexiones.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { graphData, loading, error, loadGraph };
}
