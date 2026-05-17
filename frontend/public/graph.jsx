// Graph visualization with NEURAL layout (depth-based columns) and labeled edges
const { useState, useEffect, useRef, useMemo } = React;

// Calculate depth for each node (BFS from root)
function calculateDepths(nodes, edges, rootId) {
  const depths = new Map();
  depths.set(rootId, 0);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depths.get(current);

    edges.forEach(edge => {
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

  nodes.forEach(node => {
    if (!depths.has(node.id)) {
      depths.set(node.id, 0);
    }
  });

  return depths;
}

// NEURAL layout: organize nodes in columns by depth
function calculateNeuralPositions(nodes, edges, rootId, width, height) {
  const depths = calculateDepths(nodes, edges, rootId);
  const positions = new Map();
  const depthGroups = new Map();

  nodes.forEach(node => {
    const d = depths.get(node.id) || 0;
    if (!depthGroups.has(d)) depthGroups.set(d, []);
    depthGroups.get(d).push(node);
  });

  const columnWidth = 320;
  const rowHeight = 160;
  const startX = 80;
  const centerY = height / 2;

  depthGroups.forEach((nodesInDepth, depth) => {
    const x = startX + depth * columnWidth;
    const totalHeight = nodesInDepth.length * rowHeight;
    const startYForCol = centerY - totalHeight / 2;

    nodesInDepth.forEach((node, idx) => {
      const y = startYForCol + idx * rowHeight;
      positions.set(node.id, { x, y, depth });
    });
  });

  return positions;
}

function NeuralView({ caseData, lang, onNodeClick }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !caseData || !dimensions.width) return;

    const w = dimensions.width;
    const h = dimensions.height;
    const nodes = caseData.nodes || [];
    const edges = caseData.edges || [];
    const rootId = caseData.rootId;

    const positions = calculateNeuralPositions(nodes, edges, rootId, w, h);

    // Clear SVG
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.display = 'block';
    svg.style.background = 'var(--bg-2)';

    // Create defs for markers and styles
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Arrow marker for normal edges
    const markerNormal = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerNormal.setAttribute('id', 'arrowNormal');
    markerNormal.setAttribute('markerWidth', '10');
    markerNormal.setAttribute('markerHeight', '10');
    markerNormal.setAttribute('refX', '9');
    markerNormal.setAttribute('refY', '3');
    markerNormal.setAttribute('orient', 'auto-start-reverse');
    const pathNormal = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathNormal.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    pathNormal.setAttribute('fill', '#999');
    markerNormal.appendChild(pathNormal);
    defs.appendChild(markerNormal);

    // Arrow marker for flagged edges
    const markerFlag = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerFlag.setAttribute('id', 'arrowFlag');
    markerFlag.setAttribute('markerWidth', '10');
    markerFlag.setAttribute('markerHeight', '10');
    markerFlag.setAttribute('refX', '9');
    markerFlag.setAttribute('refY', '3');
    markerFlag.setAttribute('orient', 'auto-start-reverse');
    const pathFlag = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathFlag.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    pathFlag.setAttribute('fill', 'var(--c-alert)');
    markerFlag.appendChild(pathFlag);
    defs.appendChild(markerFlag);

    svg.appendChild(defs);

    // Draw edges first (behind nodes)
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeGroup.setAttribute('class', 'edges');

    edges.forEach((edge, idx) => {
      const fromPos = positions.get(edge.s);
      const toPos = positions.get(edge.t);

      if (fromPos && toPos) {
        // Draw line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromPos.x);
        line.setAttribute('y1', fromPos.y);
        line.setAttribute('x2', toPos.x);
        line.setAttribute('y2', toPos.y);

        if (edge.flag) {
          line.setAttribute('stroke', 'var(--c-alert)');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '5,5');
          line.setAttribute('marker-end', 'url(#arrowFlag)');
        } else {
          line.setAttribute('stroke', '#999');
          line.setAttribute('stroke-width', '1');
          line.setAttribute('marker-end', 'url(#arrowNormal)');
        }
        line.setAttribute('opacity', '0.6');

        edgeGroup.appendChild(line);

        // Add label if edge has a label
        if (edge.label) {
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;

          // Background for label (white rect)
          const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          labelBg.setAttribute('x', midX - 45);
          labelBg.setAttribute('y', midY - 10);
          labelBg.setAttribute('width', '90');
          labelBg.setAttribute('height', '20');
          labelBg.setAttribute('fill', 'var(--bg-2)');
          labelBg.setAttribute('rx', '3');
          labelBg.setAttribute('opacity', '0.9');
          edgeGroup.appendChild(labelBg);

          // Label text
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', midX);
          label.setAttribute('y', midY);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'middle');
          label.setAttribute('font-size', '11');
          label.setAttribute('font-family', 'var(--font-mono)');
          label.setAttribute('fill', 'var(--ink-2)');
          label.textContent = edge.label.substring(0, 35) + (edge.label.length > 35 ? '…' : '');
          edgeGroup.appendChild(label);
        }
      }
    });

    svg.appendChild(edgeGroup);

    // Draw nodes
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'nodes');

    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = 'pointer';
      g.onclick = () => onNodeClick?.(node.id);

      // Node shadow
      if (node.id === caseData.rootId) {
        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shadow.setAttribute('cx', pos.x);
        shadow.setAttribute('cy', pos.y);
        shadow.setAttribute('r', '28');
        shadow.setAttribute('fill', 'rgba(0,0,0,0.15)');
        shadow.setAttribute('opacity', '0.3');
        g.appendChild(shadow);
      }

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', node.id === caseData.rootId ? '28' : '20');

      const colorMap = {
        person: 'var(--c-person)',
        company: 'var(--c-company)',
        contract: 'var(--c-contract)'
      };
      circle.setAttribute('fill', colorMap[node.type] || '#999');
      circle.setAttribute('opacity', '0.9');
      circle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';

      // Node border
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', node.id === caseData.rootId ? '3' : '1.5');

      g.appendChild(circle);

      // Node label below
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', pos.x);
      label.setAttribute('y', pos.y + 50);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '13');
      label.setAttribute('font-weight', '600');
      label.setAttribute('fill', 'var(--ink)');
      label.textContent = node.name.length > 20 ? node.name.substring(0, 17) + '…' : node.name;
      g.appendChild(label);

      if (node.subtitle) {
        const subtitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        subtitle.setAttribute('x', pos.x);
        subtitle.setAttribute('y', pos.y + 68);
        subtitle.setAttribute('text-anchor', 'middle');
        subtitle.setAttribute('font-size', '11');
        subtitle.setAttribute('fill', 'var(--ink-2)');
        subtitle.textContent = node.subtitle;
        g.appendChild(subtitle);
      }

      nodeGroup.appendChild(g);
    });

    svg.appendChild(nodeGroup);

    // Add depth labels at top
    const depthLabels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    depthLabels.setAttribute('class', 'depth-labels');

    const depthNames = ['RAÍZ', '1° GRADO', '2° GRADO', '3° GRADO'];
    const maxDepth = Math.max(...Array.from(positions.values()).map(p => p.depth));

    for (let i = 0; i <= maxDepth && i < 4; i++) {
      const x = 80 + i * 320;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', '30');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '600');
      label.setAttribute('fill', 'var(--ink-2)');
      label.setAttribute('opacity', '0.6');
      label.setAttribute('letter-spacing', '0.1em');
      label.textContent = depthNames[i];
      depthLabels.appendChild(label);
    }

    svg.appendChild(depthLabels);

    svgRef.current.appendChild(svg);
  }, [caseData, dimensions, onNodeClick]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', minHeight: '600px' }} />
    </div>
  );
}

// Placeholder OrbitView (can be enhanced later)
function OrbitView({ caseData, lang, onNodeClick }) {
  return (
    <div style={{ padding: 20, color: 'var(--ink-2)', fontSize: 14 }}>
      Vista de órbitas (proximamente)
    </div>
  );
}

window.NeuralView = NeuralView;
window.OrbitView = OrbitView;
