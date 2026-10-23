import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModelViewer from './ModelViewer.jsx';
import Dropzone from './components/Dropzone.jsx';
import PrinterCard, { loadChosenPrinter } from './components/PrinterCard.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import MeshHealth from './components/MeshHealth.jsx';
import Checks from './components/Checks.jsx';
import LockedQuote from './components/LockedQuote.jsx';
import QuoteTable from './components/QuoteTable.jsx';
import Advisor from './components/Advisor.jsx';
import History from './components/History.jsx';
import { api, errorText } from './api.js';
import { duration } from './format.js';
import { downloadQuotePdf } from './pdf.js';
import { go } from './router.js';
import { rememberQuote } from './myQuotes.js';
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
  const [s3Key, setS3Key] = useState(null);
  const [thin, setThin] = useState(null); // thin-wall result (arrives a moment after the rest)
  const [repairReport, setRepairReport] = useState(null);
  const [notice, setNotice] = useState('');
  const [locked, setLocked] = useState(null); // saved, server-verified quote
  const [saving, setSaving] = useState(false);
  const [printer, setPrinter] = useState(loadChosenPrinter);
  const exportWaiters = useRef(new Map());

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
        setAnalysis({
          geometry: m.geometry,
          validation: m.validation,
          overhang: m.overhang,
          units: m.units,
          buildVolume: m.buildVolume,
          addedMask: m.addedMask,
          timings: m.timings,
        });
        setThin(null);
        setLocked(null); // the part changed, so any saved quote no longer matches it
        if (m.orientation) setOrientation(m.orientation);
        if (m.repair) setRepairReport(m.repair);
        if (m.notice) setNotice(m.notice);
        setLayerIndex(null);
        setBusy(false);
      } else if (m.type === 'thin') {
        setThin({ ...m.thin, ms: m.ms });
      } else if (m.type === 'estimated') {
        setEstimate(m);
      } else if (m.type === 'exported') {
        exportWaiters.current.get(m.requestId)?.(m.buffer);
        exportWaiters.current.delete(m.requestId);
      }
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  // The worker uses the printer for build volume, wall thickness and print speeds
  useEffect(() => {
    worker.current.postMessage({ type: 'printer', printer });
  }, [printer]);

  // /app?sample=1 (from the home page) opens straight into the sample part
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sample')) {
      window.history.replaceState({}, '', '/app');
      loadSample();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A locked quote is for specific settings: changing them means it has to be saved again
  useEffect(() => setLocked(null), [settings]);

  // Re-slice whenever the part or the print settings change
  useEffect(() => {
    if (!analysis) return;
    setEstimate(null);
    const t = setTimeout(() => {
      worker.current.postMessage({ type: 'estimate', settings: { layerHeight: settings.layerHeight, infill: settings.infill } });
    }, 250);
    return () => clearTimeout(t);
  }, [analysis, settings.layerHeight, settings.infill]);

  // Ask the server to price every material whenever estimates or quantity change.
  // Retries a few times, so a server that is restarting (or a sleeping free-tier host) doesn't
  // show an error straight away.
  useEffect(() => {
    if (!estimate || !analysis) return;
    let cancelled = false;
    const body = {
      volume: analysis.geometry.volume,
      surfaceArea: analysis.geometry.surfaceArea,
      print: { extrudedVolume: estimate.print.extrudedVolume, timeS: estimate.print.timeS },
      cnc: {
        stockVolume: estimate.cnc.stockVolume,
        setups: estimate.cnc.setups,
        machiningMin: Object.fromEntries(Object.entries(estimate.cnc.perMaterial).map(([k, v]) => [k, v.machiningMin])),
      },
      quantity: settings.quantity,
      printer,
    };
    (async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const { data } = await api.post('/api/quote', body);
          if (!cancelled) setRows(data.rows);
          return;
        } catch (err) {
          const retryable = !err.response || err.response.status >= 502;
          if (cancelled) return;
          if (!retryable || attempt === 4) {
            setError(`Pricing failed: ${errorText(err)}. Is the server running?`);
            return;
          }
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estimate, analysis, settings.quantity]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setS3Key(null);
    setThin(null);
    setRepairReport(null);
    setNotice('');
    setLocked(null);
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

  async function loadSample() {
    try {
      const res = await fetch('/samples/l-bracket.stl');
      onFile(new File([await res.blob()], 'l-bracket.stl'));
    } catch {
      setError('Could not load the sample part.');
    }
  }

  // Changes to the mesh all run in the worker, which then re-analyzes and sends everything back
  const send = (msg) => {
    setBusy(true);
    worker.current.postMessage(msg);
  };
  const autoOrient = () => send({ type: 'orient' });
  const scaleBy = (factor) => send({ type: 'scale', factor });
  const rotateToFit = () => send({ type: 'fit', up: analysis.buildVolume.up });
  const repair = () => send({ type: 'repair' });

  // Ask the worker for the current mesh as a binary STL
  function exportMesh() {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      exportWaiters.current.set(requestId, resolve);
      worker.current.postMessage({ type: 'export', requestId });
    });
  }

  // Save a LOCKED quote: we send the actual mesh, and the server re-computes the price itself
  async function saveQuote() {
    setSaving(true);
    try {
      const stl = await exportMesh();
      const { data } = await api.post('/api/quotes', stl, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-quote-options': JSON.stringify({
            fileName: file.name,
            s3Key,
            settings,
            printer,
            recommendation: advice,
            clientCheapestTotal: rows?.[0]?.total,
          }),
        },
      });
      setLocked(data);
      rememberQuote(data.quoteId); // so History can show this visitor's own quotes
      setRows(data.rows); // the server's prices are the ones that count
    } catch (err) {
      setError(`Save failed: ${errorText(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function pdf() {
    downloadQuotePdf({
      fileName: file.name,
      geometry: analysis.geometry,
      validation: analysis.validation,
      settings,
      printer,
      rows,
      advice,
      locked,
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
        <div className="brand" onClick={() => go('/')} title="Home">
          <span className="logo" aria-hidden="true">M</span>
          <div>
            <h1>3D Manufacturing Quote Engine</h1>
            <p>Instant 3D printing &amp; CNC quotes</p>
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
          <div className="start">
            <div className="start-head">
              <h2>Upload a part to get a quote</h2>
              <p>STL files from any CAD program. Checked in your browser, nothing is uploaded yet.</p>
              <button className="ghost" onClick={loadSample} disabled={busy}>{busy ? 'Loading…' : 'Or try a sample part'}</button>
            </div>
            <Dropzone onFile={onFile} busy={busy} />
            <PrinterCard printer={printer} onChange={setPrinter} />
          </div>
        </main>
      ) : (
        <main className="layout">
          <section className="left">
            <div className="viewer" ref={viewerRef}>
              <ModelViewer
                positions={positions}
                geometryInfo={analysis.geometry}
                overhangMask={analysis.overhang.mask}
                thinMask={thin?.mask}
                addedMask={analysis.addedMask}
                showOverhangs={showOverhangs && !layer}
                badEdges={analysis.validation.badEdgePositions}
                layer={layer}
                printer={analysis.buildVolume.printer}
                fits={analysis.buildVolume.fits}
              />
              <div className="viewer-tools">
                <label className="check">
                  <input type="checkbox" checked={showOverhangs} onChange={(e) => setShowOverhangs(e.target.checked)} />
                  Highlights
                </label>
                <button onClick={autoOrient} disabled={busy}>{busy ? 'Working…' : 'Auto-orient'}</button>
              </div>
              {showOverhangs && !layer && (
                <div className="legend">
                  <span><i style={{ background: '#f59e0b' }} />needs support</span>
                  <span><i style={{ background: '#e5484d' }} />too thin</span>
                  {analysis.addedMask && <span><i style={{ background: '#22c55e' }} />repaired</span>}
                  <span><i style={{ background: '#ff2d55', height: 2 }} />open edge</span>
                </div>
              )}
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
            {notice && <div className="banner info" onClick={() => setNotice('')}>{notice} ✕</div>}
            <PrinterCard printer={printer} onChange={setPrinter} buildVolume={analysis.buildVolume} thin={thin} />
            <Checks
              units={analysis.units}
              buildVolume={analysis.buildVolume}
              size={analysis.geometry.bbox.size}
              thin={thin}
              watertight={analysis.validation.watertight}
              busy={busy}
              onScale={scaleBy}
              onFit={rotateToFit}
            />
            <MeshHealth
              validation={analysis.validation}
              inverted={analysis.geometry.inverted}
              report={repairReport}
              onRepair={repair}
              busy={busy}
            />

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
                    <span className="stat-label">Print time ({printer.name.replace(/ \(.*\)$/, '')})</span>
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
                  <button onClick={saveQuote} disabled={!rows || saving || busy}>{saving ? 'Locking…' : locked ? 'Saved ✓' : 'Lock & save quote'}</button>
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
              {locked && <LockedQuote quote={locked} />}
            </section>

            <Advisor summary={summary} onPick={setAdvice} />
          </section>
        </main>
      )}
    </div>
  );
}
