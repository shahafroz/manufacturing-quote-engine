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
          <strong>Drop an STL file here</strong>
          <span>or click to choose · binary or ASCII · processed in your browser</span>
        </>
      )}
    </div>
  );
}
