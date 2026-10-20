import { mm, cm3 } from '../format.js';

export default function StatsPanel({ file, geometry, timings }) {
  const [x, y, z] = geometry.bbox.size;
  const total = Object.values(timings || {}).reduce((a, b) => a + b, 0);
  return (
    <section className="card">
      <div className="card-head">
        <h2>{file.name}</h2>
        <span className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB · analyzed in {total.toFixed(0)} ms</span>
      </div>
      <div className="stats">
        <Stat label="Volume" value={cm3(geometry.volume)} />
        <Stat label="Surface area" value={`${(geometry.surfaceArea / 100).toFixed(1)} cm²`} />
        <Stat label="Size (X × Y × Z)" value={`${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)} mm`} />
        <Stat label="Triangles" value={geometry.triangleCount.toLocaleString()} />
        <Stat label="Center of mass" value={geometry.centerOfMass.map((v) => v.toFixed(1)).join(', ')} />
        <Stat label="Height" value={mm(z)} />
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
