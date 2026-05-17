import { useEffect, useRef, useState } from 'react';
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

// Calcula la profundidad de cada nodo (distancia desde el nodo raíz)
function calculateDepths(nodes, edges, rootId) {
  const depths = new Map();
  depths.set(rootId, 0);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depths.get(current);

    // Buscar todos los nodos conectados
    edges.forEach((edge) => {
      if (edge.s === current && !depths.has(edge.t)) {
        depths.set(edge.t, currentDepth + 1);
        queue.push(edge.t);
      }
      if (edge.t === current && !depths.has(edge.s)) {
        depths.set(edge.s, currentDepth + 1);
        queue.push(edge.s);
      }
    });
  }

  // Asignar profundidad a nodos sin conectar
  nodes.forEach((node) => {
    if (!depths.has(node.id)) {
      depths.set(node.id, 0);
    }
  });

  return depths;
}

// Layout NEURAL: columnas horizontales por profundidad
function calculateNeuralPositions(nodes, edges, rootId) {
  const depths = calculateDepths(nodes, edges, rootId);
  const positions = new Map();
  const depthGroups = new Map();

  nodes.forEach((node) => {
    const d = depths.get(node.id) || 0;
    if (!depthGroups.has(d)) depthGroups.set(d, []);
    depthGroups.get(d).push(node);
  });

  const columnWidth = 320;
  const rowHeight = 160;
  const startX = -200;
  const startY = 0;

  depthGroups.forEach((nodesInDepth, depth) => {
    const x = startX + depth * columnWidth;
    const totalHeight = nodesInDepth.length * rowHeight;
    const centerY = startY - totalHeight / 2;

    nodesInDepth.forEach((node, idx) => {
      const y = centerY + idx * rowHeight;
      positions.set(node.id, { x, y, depth });
    });
  });

  return positions;
}

// Layout ORBIT: radial alrededor del nodo seleccionado
function calculateOrbitPositions(nodes, edges, centerNodeId) {
  const positions = new Map();
  const centerNode = nodes.find((n) => n.id === centerNodeId);
  if (!centerNode) return positions;

  positions.set(centerNodeId, { x: 0, y: 0, depth: 0 });

  const otherNodes = nodes.filter((n) => n.id !== centerNodeId);
  const itemsPerRing = 4;
  const baseRadius = 220;

  otherNodes.forEach((node, idx) => {
    const ring = Math.floor(idx / itemsPerRing);
    const posInRing = idx % itemsPerRing;
    const angle = (posInRing / itemsPerRing) * Math.PI * 2;
    const radius = baseRadius + ring * 140;

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    positions.set(node.id, { x, y, depth: ring + 1 });
  });

  return positions;
}

function toVisNodes(nodes, positions, selectedNodeId, layout) {
  return nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    const isSelected = n.id === selectedNodeId && layout === 'orbit';
    const isRoot = n.is_root;

    let size = isRoot ? 40 : 22 + Math.min(n.risk_score / 10, 14);
    if (isSelected) size *= 1.3;

    return {
      id:       n.id,
      label:    n.name.length > 24 ? n.name.slice(0, 22) + '…' : n.name,
      title:    `${n.name}\n${n.metadata?.role || n.metadata?.sector || ''}`.trim(),
      color:    isSelected ? { background: NODE_COLORS[n.type].background, border: '#000', highlight: { background: NODE_COLORS[n.type].background, border: '#000' } } : NODE_COLORS[n.type],
      shape:    NODE_SHAPES[n.type] || 'ellipse',
      size:     size,
      font:     { color: NODE_COLORS[n.type]?.font || '#fff', size: isSelected ? 13 : 11, bold: isSelected ? '900' : '600' },
      borderWidth: isSelected ? 4 : (isRoot ? 3 : 1.5),
      x:        pos.x,
      y:        pos.y,
      fixed:    { x: true, y: true },
      shadow:   { enabled: isSelected || isRoot, color: 'rgba(0,0,0,0.2)', size: isSelected ? 25 : 15, x: 0, y: 0 },
    };
  });
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
    smooth: { type: 'cubic', forceDirection: 'horizontal' },
  }));
}

const VIS_OPTIONS = {
  physics: { enabled: false }, // Desactivar física ya que posiciones son fijas
  interaction: {
    hover: true,
    tooltipDelay: 200,
    zoomView: true,
    dragView: true,
    navigationButtons: false,
    keyboard: false,
  },
  layout: {
    improvedLayout: false,
    hierarchical: false, // Usar posiciones personalizadas
  },
};

export default function GraphCanvas({ data, onNodeClick, focusNodeId, layout = 'neural' }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const rootNode = data.nodes.find((n) => n.is_root);
    const rootId = rootNode?.id || data.nodes[0]?.id;

    // Seleccionar layout basado en prop
    let positions;
    if (layout === 'orbit') {
      positions = calculateOrbitPositions(data.nodes, data.edges, focusNodeId || rootId);
    } else {
      positions = calculateNeuralPositions(data.nodes, data.edges, rootId);
    }

    const nodes = new DataSet(toVisNodes(data.nodes, positions, focusNodeId || rootId, layout));
    const edges = new DataSet(toVisEdges(data.edges));
    const network = new Network(containerRef.current, { nodes, edges }, VIS_OPTIONS);

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        onNodeClick?.(params.nodes[0]);
      }
    });

    networkRef.current = network;

    // Fit to view
    setTimeout(() => {
      network.fit({ animation: { duration: 300 }, padding: { top: 50, right: 50, bottom: 50, left: 50 } });
    }, 50);

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [data, layout, focusNodeId, onNodeClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Etiquetas de profundidad para layout Neural */}
      {layout === 'neural' && data && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', height: '60px', alignItems: 'center', paddingLeft: '100px', fontSize: '12px', opacity: 0.6, fontWeight: '600', letterSpacing: '0.1em', gap: '280px' }}>
            <span>RAÍZ</span>
            <span>1° GRADO</span>
            <span>2° GRADO</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: 'var(--bg)' }}
      />
    </div>
  );
}
