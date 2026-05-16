import { useState } from 'react';
import SearchBar   from './components/ui/SearchBar';
import GraphCanvas from './components/graph/GraphCanvas';
import NodeDetail  from './components/ui/NodeDetail';
import { useGraph } from './hooks/useGraph';

export default function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const { graphData, loading, error, loadGraph } = useGraph();

  const handleSelectResult = (node) => {
    loadGraph(node.id);
    setSelectedNode(node);
  };

  const handleNodeClick = (nodeId) => {
    if (!graphData) return;
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (node) setSelectedNode(node);
  };

  return (
    <div className="flex flex-col h-screen">

      {/* ── Header ── */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 bg-gray-950 z-10">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Mapa de Poder Político</h1>
          <p className="text-xs text-gray-500">Transparencia · LATAM</p>
        </div>
        <div className="flex-1 max-w-lg">
          <SearchBar onSelect={handleSelectResult} />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex flex-1 overflow-hidden">

        {/* Grafo */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950/70 z-20">
              <span className="text-sm text-gray-400">Cargando red...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}
          {!graphData && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-600">
              <span className="text-4xl">⬡</span>
              <p className="text-sm">Busca un funcionario, empresa o contrato para explorar su red</p>
            </div>
          )}
          {graphData && (
            <GraphCanvas
              data={graphData}
              onNodeClick={handleNodeClick}
              focusNodeId={selectedNode?.id}
            />
          )}
        </div>

        {/* Panel lateral de detalle */}
        {selectedNode && (
          <NodeDetail
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onExpandNetwork={() => loadGraph(selectedNode.id, 3)}
          />
        )}

      </main>
    </div>
  );
}
