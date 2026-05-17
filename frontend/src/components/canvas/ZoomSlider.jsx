import React from 'react';

export default function ZoomSlider({ zoom, setZoom, onReset, min = 0.35, max = 2.8 }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="graph-controls">
      <button title="Zoom in" onClick={() => setZoom(z => Math.min(max, z * 1.18))}>＋</button>
      <input
        type="range"
        min={min}
        max={max}
        step={0.02}
        value={zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        className="zoom-slider"
        title={`${pct}%`}
      />
      <button title="Zoom out" onClick={() => setZoom(z => Math.max(min, z / 1.18))}>−</button>
      <div className="zoom-pct" title="Reset" onClick={onReset}>{pct}%</div>
    </div>
  );
}
