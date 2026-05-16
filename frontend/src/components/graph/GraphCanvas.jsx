import { useEffect, useRef } from 'react';
import { Network, DataSet } from 'vis-network/standalone';

// Paleta de colores por tipo de nodo
const NODE_COLORS = {
  person:   { background: '#534AB7', border: '#AFA9EC', font: '#EEEDFE' },
  company:  { background: '#0F6E56', border: '#5DCAA5', font: '#E1F5EE' },
  contract: { background: '#993C1D', border: '#F0997B', font: '#FAECE7' },
};

const NODE_SHAPES = {
  person:   'ellipse',
  company:  'box',
  contract: 'diamond',
};

function toVisNodes(nodes) {
  return nodes.map((n) => ({
    id:    n.id,
    label: n.name.length > 28 ? n.name.slice(0, 26) + '…' : n.name,
    title: `${n.name}\n${n.metadata?.role || n.metadata?.sector || ''}`.trim(),
    color: NODE_COLORS[n.type] || NODE_COLORS.person,
    shape: NODE_SHAPES[n.type] || 'ellipse',
    size:  n.is_root ? 28 : 18 + Math.min(n.risk_score / 10, 12),
    font:  { color: NODE_COLORS[n.type]?.font || '#fff', size: 12 },
    borderWidth: n.is_root ? 3 : 1,
  }));
}

function toVisEdges(edges) {
  return edges.map((e) => ({
    id:     e.id,
    from:   e.source_id,
    to:     e.target_id,
    label:  e.label || '',
    title:  e.label,
    color:  { color: '#4B4B4B', highlight: '#888' },
    width:  1 + Math.min(Math.log10(e.weight + 1) * 0.5, 3),
    font:   { size: 10, color: '#888', align: 'middle' },
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    smooth: { type: 'dynamic' },
  }));
}

const VIS_OPTIONS = {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: { gravitationalConstant: -50, springLength: 120, springConstant: 0.04 },
    stabilization: { iterations: 150 },
  },
  interaction: {
    hover: true,
    tooltipDelay: 200,
    zoomView: true,
    dragView: true,
  },
  layout: { improvedLayout: true },
};

export default function GraphCanvas({ data, onNodeClick, focusNodeId }) {
  const containerRef = useRef(null);
  const networkRef   = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const nodes   = new DataSet(toVisNodes(data.nodes));
    const edges   = new DataSet(toVisEdges(data.edges));
    const network = new Network(containerRef.current, { nodes, edges }, VIS_OPTIONS);

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        onNodeClick?.(params.nodes[0]);
      }
    });

    networkRef.current = network;

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [data]);

  // Cuando cambia el nodo foco, hacer zoom sobre él
  useEffect(() => {
    if (networkRef.current && focusNodeId) {
      networkRef.current.focus(focusNodeId, { scale: 1.2, animation: { duration: 500 } });
    }
  }, [focusNodeId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#0a0a0f' }}
    />
  );
}
