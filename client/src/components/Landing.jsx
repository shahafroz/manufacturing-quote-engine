import Dropzone from './Dropzone.jsx';

const STEPS = [
  { icon: '⬆', bg: '#fff0e9', title: 'Upload your model', text: 'Drag in an STL file. It is checked right in your browser, so nothing is uploaded until you save a quote.' },
  { icon: '🔍', bg: '#e8f0fd', title: 'See how it will print', text: 'Spin the part in 3D, spot problems in red, and flip through every printed layer.' },
  { icon: '💬', bg: '#e9f8ef', title: 'Get your price', text: 'Compare five materials across 3D printing and CNC, then save or download the quote.' },
];

const AUDIENCE = [
  { bg: '#fff0e9', title: 'Makers & hobbyists', text: 'Find out what a print will cost and how long it takes before you hit print.' },
  { bg: '#e8f0fd', title: 'Small print shops', text: 'Send customers a clear, consistent quote in seconds instead of slicing every request by hand.' },
  { bg: '#efe8fd', title: 'Engineers & teams', text: 'Compare plastic and metal, check printability early, and pick the right process.' },
];

export default function Landing({ onFile, onSample, busy }) {
  return (
    <div className="landing">
      <section className="hero">
        <div>
          <span className="pill">✨ Free instant quotes</span>
          <h2>
            Get a price for your 3D part <em>in seconds</em>.
          </h2>
          <p>
            Upload a 3D model and see what it costs to 3D print or CNC machine, plus how long it takes and whether it will
            print cleanly.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onSample} disabled={busy}>
              {busy ? 'Loading…' : 'Try it with a sample part'}
            </button>
            <label className="ghost">
              Upload your STL
              <input type="file" accept=".stl" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
            </label>
          </div>
          <div className="trust">
            <span>No sign-up</span>
            <span>Files stay in your browser</span>
            <span>3D print + CNC</span>
          </div>
        </div>
        <QuotePreview />
      </section>

      <Dropzone onFile={onFile} busy={busy} />

      <section>
        <div className="section-title">
          <h3>How it works</h3>
          <p>Three steps, no slicer software needed.</p>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.title} className="step">
              <div className="step-icon" style={{ background: s.bg }} aria-hidden="true">{s.icon}</div>
              <h4>{s.title}</h4>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3>Made for anyone who makes things</h3>
        </div>
        <div className="audience">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="aud" style={{ background: a.bg }}>
              <h4>{a.title}</h4>
              <p>{a.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// A friendly mock-up of what a quote looks like (numbers from the real sample part)
function QuotePreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-card">
        <div className="preview-top">
          <span className="file">STL</span>
          <div>
            l-bracket.stl
            <small>40 × 30 × 30 mm · 7.9 cm³</small>
          </div>
        </div>
        <div className="preview-art">
          <Bracket />
        </div>
        <div className="preview-rows">
          <div className="preview-row best"><span>PLA · 3D print</span><b>$1.80</b></div>
          <div className="preview-row"><span>PETG · 3D print</span><b>$1.82</b></div>
          <div className="preview-row"><span>Aluminum · CNC</span><b>$153</b></div>
        </div>
      </div>
      <div className="float-badge"><i /> Ready to print · 34 min</div>
    </div>
  );
}

// Isometric L-bracket with soft shading
function Bracket() {
  return (
    <svg viewBox="0 0 220 160" width="220" height="160">
      <ellipse cx="112" cy="138" rx="86" ry="12" fill="#dfe5ef" />
      {/* base plate */}
      <polygon points="40,104 120,64 190,99 110,139" fill="#ffb08f" />
      <polygon points="110,139 190,99 190,111 110,151" fill="#f27a4e" />
      <polygon points="40,104 110,139 110,151 40,116" fill="#f8936a" />
      {/* upright */}
      <polygon points="40,40 54,33 54,97 40,104" fill="#f27a4e" />
      <polygon points="54,33 124,68 124,132 54,97" fill="#ffa07a" />
      <polygon points="40,40 54,33 124,68 110,75" fill="#ffc7b0" />
    </svg>
  );
}
