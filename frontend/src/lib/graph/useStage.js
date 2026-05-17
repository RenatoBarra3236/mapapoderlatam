import { useEffect, useRef, useState } from 'react';

export function useStage(initialZoom = 0.92) {
  const stageRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const u = () => {
      if (stageRef.current) {
        const r = stageRef.current.getBoundingClientRect();
        setDims({ w: r.width, h: r.height });
      }
    };
    u();
    const ro = new ResizeObserver(u);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  const handlers = {
    onWheel: (e) => {
      e.preventDefault();
      const d = -e.deltaY * 0.0015;
      setZoom(z => Math.max(0.35, Math.min(2.8, z + d * z)));
    },
    onMouseDown: (e) => {
      if (e.target.closest('.node-hit')) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    onMouseMove: (e) => {
      if (!isDragging) return;
      setPan({
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y)
      });
    },
    onMouseUp: () => setDragging(false),
    onMouseLeave: () => setDragging(false)
  };

  const reset = () => { setZoom(initialZoom); setPan({ x: 0, y: 0 }); };

  return { stageRef, dims, zoom, setZoom, pan, isDragging, handlers, reset };
}
