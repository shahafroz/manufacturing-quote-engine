import { useRef, useState } from 'react';

export default function Dropzone({ onFile, busy, compact }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  function pick(files) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`dropzone ${over ? 'over' : ''} ${compact ? 'compact' : ''}`}
      onClick={() => input.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && input.current.click()}
    >
      <input ref={input} type="file" accept=".stl" hidden onChange={(e) => pick(e.target.files)} />
      {busy ? (
        <span>Analyzing…</span>
      ) : compact ? (
        <span>Upload another STL</span>
      ) : (
        <>
          <span className="drop-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
          </span>
          <strong>Drop your STL file here</strong>
          <span>or click to browse · any size · stays on your computer</span>
        </>
      )}
    </div>
  );
}
