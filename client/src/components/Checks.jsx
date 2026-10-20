import { UNIT_OPTIONS } from '../engine/units.js';

// Printability checks: units, printer size and wall thickness, each with a fix when there is one.
export default function Checks({ units, buildVolume, size, thin, watertight, busy, onScale, onFit }) {
  const p = buildVolume.printer;
  return (
    <section className="card">
      <h3>Printability checks</h3>
      <ul className="checks">
        {units ? (
          <Check status="warn" title="Units look wrong">
            This part is {units.reason}. Was it designed in different units?
            <div className="fix-row">
              {units.options.map((u) => (
                <button key={u} className="fix" disabled={busy} onClick={() => onScale(UNIT_OPTIONS[u].factor)}>
                  It's {UNIT_OPTIONS[u].label} (×{UNIT_OPTIONS[u].factor})
                </button>
              ))}
            </div>
          </Check>
        ) : (
          <Check status="ok" title="Size looks right">
            {size.map((v) => v.toFixed(1)).join(' × ')} mm
          </Check>
        )}

        {buildVolume.fits ? (
          <Check status="ok" title={`Fits the ${p.name}`}>
            Build volume {p.x} × {p.y} × {p.z} mm
          </Check>
        ) : buildVolume.canFit ? (
          <Check status="warn" title={`Too big for the ${p.name} as it is`}>
            It fits if it's turned on its side ({buildVolume.rotatedSize.map((v) => v.toFixed(0)).join(' × ')} mm).
            <div className="fix-row">
              <button className="fix" disabled={busy} onClick={onFit}>Rotate to fit</button>
            </div>
          </Check>
        ) : (
          <Check status="bad" title={`Too big for the ${p.name}`}>
            It doesn't fit in {p.x} × {p.y} × {p.z} mm any way round. Split it into pieces, scale it down, or choose CNC.
          </Check>
        )}

        {!thin ? (
          <Check status="pending" title="Checking wall thickness…" />
        ) : thin.thinArea > 0 ? (
          <Check status="warn" title={`Thin walls: ${(thin.thinArea / 100).toFixed(2)} cm² under ${thin.minWall} mm`}>
            Thinnest about {thin.minThickness.toFixed(2)} mm, shown in red. These areas may print weak or not at all.
            {!watertight && ' (Less reliable on a broken mesh: repair it first.)'}
          </Check>
        ) : (
          <Check status="ok" title={`No walls thinner than ${thin.minWall} mm`}>
            Checked {thin.checked.toLocaleString()} faces in {Math.round(thin.ms)} ms
          </Check>
        )}
      </ul>
    </section>
  );
}

function Check({ status, title, children }) {
  const icon = { ok: '✓', warn: '!', bad: '✕', pending: '…' }[status];
  return (
    <li className={`check-item ${status}`}>
      <span className="check-icon" aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        {children && <div className="check-text">{children}</div>}
      </div>
    </li>
  );
}
