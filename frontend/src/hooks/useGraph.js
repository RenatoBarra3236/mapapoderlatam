import { useState, useCallback } from 'react';

export function useGraph() {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentCase, setCurrentCase] = useState(null);

  const loadGraph = useCallback((nodeId, caseId, depth = 2) => {
    setLoading(true);
    setError(null);
    try {
      // Obtener los datos del caso desde window.DEMO_CASES
      if (!window.DEMO_CASES || !caseId) {
        setError('No se encontró el caso');
        return;
      }

      const caseData = window.DEMO_CASES[caseId];
      if (!caseData) {
        setError('No se encontró el caso');
        return;
      }

      // Aquí podrías implementar lógica para filtrar el grafo por profundidad
      // Por ahora, retorna el grafo completo
      setGraphData({
        nodes: caseData.nodes.map((node) => ({
          ...node,
          id: node.id,
          is_root: node.id === caseData.rootId,
          risk_score: node.risk || 0,
        })),
        edges: caseData.edges.map((edge, idx) => ({
          ...edge,
          id: idx,
          source_id: edge.s,
          target_id: edge.t,
        })),
      });

      setCurrentCase(caseData);
    } catch (err) {
      setError('No se pudo cargar la red de conexiones.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { graphData, loading, error, loadGraph, currentCase };
}
