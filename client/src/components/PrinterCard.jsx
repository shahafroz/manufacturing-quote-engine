import { useState } from 'react';
import { PRESET_PRINTERS, sanitizePrinter, checkCompatibility } from '../engine/printers.js';

const SPEED_CLASSES = [
  { id: 'generic', label: 'Standard (older / budget printers)' },
  { id: 'prusa-mk4', label: 'Fast (modern bed-slinger)' },
  { id: 'bambu-p1s', label: 'Very fast (CoreXY)' },
];
const KEY_LIST = 'mqe.printers';
const KEY_PICK = 'mqe.printer';

// localStorage can be blocked (private mode), so every access is wrapped
const load = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not saved, still works this visit */ }
};

export function loadCustomPrinters() {
  return load(KEY_LIST, []).map(sanitizePrinter);
}

// The printer chosen last time (preset or custom)
export function loadChosenPrinter() {
  const id = load(KEY_PICK, 'generic');
  return loadCustomPrinters().find((p) => p.id === id) || PRESET_PRINTERS.find((p) => p.id === id) || PRESET_PRINTERS[0];
}

const EMPTY = { name: '', x: 220, y: 220, z: 250, nozzle: 0.4, enclosed: false, hourlyRate: 2.5, speedClass: 'prusa-mk4' };

export default function PrinterCard({ printer, onChange, buildVolume, thin }) {
  const [custom, setCustom] = useState(loadCustomPrinters);
  const [form, setForm] = useState(null); // null = closed

  function pick(id) {
    if (id === '__add') return setForm({ ...EMPTY });
    const p = custom.find((c) => c.id === id) || PRESET_PRINTERS.find((c) => c.id === id);
    save(KEY_PICK, p.id);
    onChange(p);
  }

  function saveForm(e) {
    e.preventDefault();
    const speeds = PRESET_PRINTERS.find((p) => p.id === form.speedClass).speeds;
    const id = form.id || `custom-${Date.now().toString(36)}`;
    const p = sanitizePrinter({ ...form, id, speeds, custom: true });
    const next = [...custom.filter((c) => c.id !== id), p];
    setCustom(next);
    save(KEY_LIST, next);
    save(KEY_PICK, id);
    setForm(null);
    onChange(p);
  }

  function remove() {
    const next = custom.filter((c) => c.id !== printer.id);
    setCustom(next);
    save(KEY_LIST, next);
    pick('generic');
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? +e.target.value : e.target.value }));
  const items = buildVolume ? checkCompatibility(printer, { buildVolume, thin }) : [];

  return (
    <section className="card">
      <div className="card-head">
        <h3>Printer</h3>
        {printer.custom && !form && (
          <div className="actions">
            <button className="link" onClick={() => setForm({ ...printer, speedClass: SPEED_CLASSES.find((c) => PRESET_PRINTERS.find((p) => p.id === c.id).speeds.perimeterSpeed === printer.speeds.perimeterSpeed)?.id || 'prusa-mk4' })}>edit</button>
            <button className="link" onClick={remove}>remove</button>
          </div>
        )}
      </div>
      <div className="printer-row">
        <select value={printer.id} onChange={(e) => pick(e.target.value)} aria-label="Printer">
          {PRESET_PRINTERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {custom.length > 0 && (
            <optgroup label="Your printers">
              {custom.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          )}
          <option value="__add">+ Add your printer…</option>
        </select>
        {!form && <button className="fix" onClick={() => setForm({ ...EMPTY })}>+ Add printer</button>}
      </div>
      <p className="printer-specs">
        {printer.x} × {printer.y} × {printer.z} mm · {printer.nozzle} mm nozzle · {printer.enclosed ? 'enclosed' : 'open frame'} · ${printer.hourlyRate}/h machine rate
      </p>

      {form && (
        <form className="printer-form" onSubmit={saveForm}>
          <label className="wide">Name<input required maxLength={60} value={form.name} onChange={set('name')} placeholder="My Voron 2.4" /></label>
          <label className="wide">Speed
            <select value={form.speedClass} onChange={set('speedClass')}>
              {SPEED_CLASSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label>Width X (mm)<input type="number" min={20} max={2000} value={form.x} onChange={set('x')} /></label>
          <label>Depth Y (mm)<input type="number" min={20} max={2000} value={form.y} onChange={set('y')} /></label>
          <label>Height Z (mm)<input type="number" min={20} max={2000} value={form.z} onChange={set('z')} /></label>
          <label>Nozzle (mm)
            <select value={form.nozzle} onChange={set('nozzle')}>
              {[0.2, 0.4, 0.6, 0.8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>Rate ($/hour)<input type="number" min={0.1} max={500} step={0.1} value={form.hourlyRate} onChange={set('hourlyRate')} /></label>
          <div className="row-end">
            <label className="inline"><input type="checkbox" checked={form.enclosed} onChange={set('enclosed')} /> Enclosed</label>
            <button type="button" className="fix" onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" className="fix strong">Save printer</button>
          </div>
        </form>
      )}

      {items.length > 0 && (
        <>
          <h4 className="sub">Compatibility</h4>
          <ul className="checks">
            {items.map((it) => (
              <li key={it.text} className={`check-item ${it.status}`}>
                <span className="check-icon" aria-hidden="true">{{ ok: '✓', warn: '!', bad: '✕', pending: '…' }[it.status]}</span>
                <div><strong>{it.text}</strong></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
