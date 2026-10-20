import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModelViewer from './ModelViewer.jsx';
import Dropzone from './components/Dropzone.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import MeshHealth from './components/MeshHealth.jsx';
import QuoteTable from './components/QuoteTable.jsx';
import Advisor from './components/Advisor.jsx';
import History from './components/History.jsx';
import { api, errorText } from './api.js';
import { duration } from './format.js';
import { downloadQuotePdf } from './pdf.js';
import './App.css';

const DEFAULT_SETTINGS = { layerHeight: 0.2, infill: 0.2, quantity: 1 };

export default function App() {
  const [tab, setTab] = useState('quote');
  const [backend, setBackend] = useState('checking');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [positions, setPositions] = useState(null);
  const [analysis, setAnalysis] = useState(null); // geometry, validation, overhang, timings
  const [orientation, setOrientation] = useState(null);
  const [estimate, setEstimate] = useState(null); // layers, print, cnc
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [rows, setRows] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [showOverhangs, setShowOverhangs] = useState(true);
  const [layerIndex, setLayerIndex] = useState(null);
  const [saved, setSaved] = useState('');
  const [s3Key, setS3Key] = useState(null);

  const worker = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    api.get('/api/health').then(() => setBackend('connected')).catch(() => setBackend('offline'));
  }, []);

  // One background worker for the whole session
  useEffect(() => {
    const w = new Worker(new URL('./engine/worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'error') {
        setError(m.message);
        setBusy(false);
      } else if (m.type === 'analyzed') {
        setPositions(m.positions);
        setAnalysis({ geometry: m.geometry, validation: m.validation, overhang: m.overhang, timings: m.timings });
        if (m.orientation) setOrientation(m.orientation);
        setLayerIndex(null);
        setBusy(false);
      } else if (m.type === 'estimated') {
        setEstimate(m);
      }
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  // Re-slice whenever the part or the print settings change
  useEffect(() => {
    if (!analysis) return;
    setEstimate(null);
    const t = setTimeout(() => {
      worker.current.postMessage({ type: 'estimate', settings: { layerHeight: settings.layerHeight, infill: settings.infill } });
    }, 250);
    return () => clearTimeout(t);
  }, [analysis, settings.layerHeight, settings.infill]);

  // Ask the server to price every material whenever estimates or quantity change
  useEffect(() => {
    if (!estimate || !analysis) return;
    api
      .post('/api/quote', {
        volume: analysis.geometry.volume,
        surfaceArea: analysis.geometry.surfaceArea,
        print: { extrudedVolume: estimate.print.extrudedVolume, timeS: estimate.print.timeS },
        cnc: {
          stockVolume: estimate.cnc.stockVolume,
          setups: estimate.cnc.setups,
          machiningMin: Object.fromEntries(Object.entries(estimate.cnc.perMaterial).map(([k, v]) => [k, v.machiningMin])),
        },
        quantity: settings.quantity,
      })
      .then(({ data }) => setRows(data.rows))
      .catch((err) => setError(`Pricing failed: ${errorText(err)}`));
  }, [estimate, analysis, settings.quantity]);

  const onFile = useCallback(async (f) => {
    if (!/\.stl$/i.test(f.name)) {
      setError('Please choose a .stl file.');
      return;
    }
    setError('');
    setFile(f);
    setBusy(true);
    setRows(null);
    setEstimate(null);
    setAdvice(null);
    setOrientation(null);
    setSaved('');
    setS3Key(null);
    const buffer = await f.arrayBuffer();
    worker.current.postMessage({ type: 'analyze', buffer }, [buffer]);

    // Optional: keep a copy of the STL in S3 (only if the server has AWS configured)
    api
      .post('/api/upload-url', { fileName: f.name, size: f.size })
      .then(async ({ data }) => {
        if (!data.enabled) return;
        await fetch(data.url, { method: 'PUT', body: f, headers: { 'Content-Type': 'model/stl' } });
        setS3Key(data.key);
      })
      .catch(() => {});
  }, []);

  function autoOrient() {
    setBusy(true);
    worker.current.postMessage({ type: 'orient' });
  }

  async function saveQuote() {
    try {
      const { data } = await api.post('/api/quotes', {
        fileName: file.name,
        s3Key,
        geometry: { ...analysis.geometry },
        validation: { ...analysis.validation, badEdgePositions: undefined },
        settings,
        print: { timeS: estimate.print.timeS, extrudedVolume: estimate.print.extrudedVolume, layers: estimate.print.layers },
        cnc: { stockVolume: estimate.cnc.stockVolume, setups: estimate.cnc.setups },
        rows,
        recommendation: advice,
      });
      setSaved(`Saved (${data.storage === 'mongodb' ? 'MongoDB' : 'server memory'})`);
    } catch (err) {
      setError(`Save failed: ${errorText(err)}`);
    }
  }

  function pdf() {
    downloadQuotePdf({
      fileName: file.name,
      geometry: analysis.geometry,
      validation: analysis.validation,
      settings,
      rows,
      advice,
      canvas: viewerRef.current?.querySelector('canvas'),
    });
  }

  const layer = estimate && layerIndex !== null ? estimate.layers[layerIndex] : null;
  const summary = useMemo(
    () =>
      analysis && {
        volumeCm3: +(analysis.geometry.volume / 1000).toFixed(2),
        sizeMm: analysis.geometry.bbox.size.map((v) => +v.toFixed(1)),
        watertight: analysis.validation.watertight,
        supportCm3: +(analysis.overhang.supportVolume / 1000).toFixed(2),
      },
    [analysis],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <h1>Manufacturing Quote Engine</h1>
            <p>STL → geometry, mesh check, slicing and instant 3D-print / CNC quote</p>
          </div>
        </div>
        <nav>
          <button className={tab === 'quote' ? 'active' : ''} onClick={() => setTab('quote')}>Quote</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
          <span className={`dot ${backend}`} title={`Backend ${backend}`}>API {backend}</span>
        </nav>
      </header>

      {error && <div className="banner error" onClick={() => setError('')}>{error} ✕</div>}

      {tab === 'history' ? (
        <main className="single"><History /></main>
      ) : !positions ? (
        <main className="single">
          <Dropzone onFile={onFile} busy={busy} />
        </main>
      ) : (
        <main className="layout">
          <section className="left">
            <div className="viewer" ref={viewerRef}>
              <ModelViewer
                positions={positions}
                geometryInfo={analysis.geometry}
                overhangMask={analysis.overhang.mask}
                showOverhangs={showOverhangs && !layer}
                badEdges={analysis.validation.badEdgePositions}
                layer={layer}
              />
              <div className="viewer-tools">
                <label className="check">
                  <input type="checkbox" checked={showOverhangs} onChange={(e) => setShowOverhangs(e.target.checked)} />
                  Overhangs
                </label>
                <button onClick={autoOrient} disabled={busy}>{busy ? 'Working…' : 'Auto-orient'}</button>
              </div>
            </div>

            {estimate && (
              <div className="card layer-card">
                <div className="row">
                  <label htmlFor="layer">Layer view</label>
                  <span className="muted">
                    {layer
                      ? `Layer ${layerIndex + 1} / ${estimate.layers.length} · z = ${(layer.z - estimate.minZ).toFixed(2)} mm · ${layer.loops.length} loops · ${(Math.max(0, layer.area) / 100).toFixed(1)} cm²`
                      : `${estimate.layers.length} layers, drag to inspect`}
                  </span>
                  {layer && <button className="link" onClick={() => setLayerIndex(null)}>show part</button>}
                </div>
                <input
                  id="layer"
                  type="range"
                  min={0}
                  max={estimate.layers.length - 1}
                  value={layerIndex ?? 0}
                  onChange={(e) => setLayerIndex(+e.target.value)}
                />
              </div>
            )}

            <Dropzone onFile={onFile} busy={busy} compact />
          </section>

          <section className="right">
            <StatsPanel file={file} geometry={analysis.geometry} timings={{ ...analysis.timings, ...(estimate?.timings || {}) }} />
            <MeshHealth validation={analysis.validation} inverted={analysis.geometry.inverted} />

            <section className="card">
              <h3>Printability</h3>
              <div className="stats">
                <div className="stat">
                  <span className="stat-label">Overhang area (&gt;45°)</span>
                  <span className="stat-value">{(analysis.overhang.overhangArea / 100).toFixed(1)} cm²</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Support volume</span>
                  <span className="stat-value">{(analysis.overhang.supportVolume / 1000).toFixed(2)} cm³</span>
                </div>
                {estimate && (
                  <div className="stat">
                    <span className="stat-label">Print time (PLA)</span>
                    <span className="stat-value">{duration(estimate.print.timeS)}</span>
                  </div>
                )}
              </div>
              {orientation && (
                <p className="note">
                  Auto-orient: support {(orientation.before.supportVolume / 1000).toFixed(2)} → {(orientation.after.supportVolume / 1000).toFixed(2)} cm³
                  {' '}(<strong>{Math.round(orientation.reduction * 100)}% less</strong>)
                </p>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Quote</h3>
                <div className="actions">
                  <button onClick={saveQuote} disabled={!rows}>Save quote</button>
                  <button onClick={pdf} disabled={!rows}>Download PDF</button>
                </div>
              </div>
              <div className="controls">
                <label>
                  Infill <strong>{Math.round(settings.infill * 100)}%</strong>
                  <input type="range" min={5} max={100} step={5} value={settings.infill * 100}
                    onChange={(e) => setSettings((s) => ({ ...s, infill: +e.target.value / 100 }))} />
                </label>
                <label>
                  Layer height
                  <select value={settings.layerHeight} onChange={(e) => setSettings((s) => ({ ...s, layerHeight: +e.target.value }))}>
                    <option value={0.1}>0.10 mm (fine)</option>
                    <option value={0.2}>0.20 mm (standard)</option>
                    <option value={0.3}>0.30 mm (draft)</option>
                  </select>
                </label>
                <label>
                  Quantity
                  <input type="number" min={1} max={1000} value={settings.quantity}
                    onChange={(e) => setSettings((s) => ({ ...s, quantity: Math.max(1, Math.min(1000, +e.target.value || 1)) }))} />
                </label>
              </div>
              {rows ? <QuoteTable rows={rows} recommended={advice?.materialId} quantity={settings.quantity} /> : <p className="muted">Slicing and pricing…</p>}
              {saved && <p className="note">{saved}</p>}
            </section>

            <Advisor summary={summary} onPick={setAdvice} />
          </section>
        </main>
      )}
    </div>
  );
}
