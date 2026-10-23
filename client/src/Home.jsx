import { go } from './router.js';
import { PRESET_PRINTERS } from './engine/printers.js';
import './App.css';

const STEPS = [
  { icon: '⬆', bg: '#fff0e9', title: 'Upload your model', text: 'Drag in an STL file. It is checked right in your browser, so nothing is uploaded until you save a quote.' },
  { icon: '🔍', bg: '#e8f0fd', title: 'See how it will print', text: 'Spin the part in 3D, spot problems, fix them in one click, and flip through every printed layer.' },
  { icon: '💬', bg: '#e9f8ef', title: 'Get your price', text: 'Pick your printer, compare five materials across 3D printing and CNC, then lock or download the quote.' },
];

const PROS = [
  { icon: '⚡', title: 'Instant, no sign-up', text: 'A full price in a couple of seconds. No account, no email, no waiting for a shop to reply.' },
  { icon: '🔒', title: 'Your file stays with you', text: 'The model is analysed on your own computer. It is only sent when you choose to lock a quote.' },
  { icon: '🛠', title: 'Fixes problems for you', text: 'Holes, flipped faces, wrong units, thin walls and parts too big for the printer are found and most are fixed in one click.' },
  { icon: '🖨', title: 'Your printer, your rates', text: 'Choose a popular printer or add your own: build size, nozzle, speed and hourly rate all change the quote.' },
  { icon: '📏', title: 'Honest numbers', text: 'Print time and filament are tested against PrusaSlicer, and the results, including where it is off, are published.' },
  { icon: '🤖', title: 'Help choosing a material', text: 'Describe what the part is for and an AI advisor suggests a material, with its reason.' },
];

// ✓ = yes, ~ = partly / sometimes, ✕ = no. Typical tools in each group, not one specific product.
const COMPARE = [
  ['Price in seconds, no account', '✓', '~ often needs sign-up', '✕ time & filament only'],
  ['Model stays on your device', '✓ until you save', '✕ uploaded first', '✓'],
  ['3D printing and CNC side by side', '✓', '~ some', '✕'],
  ['Finds and repairs mesh problems', '✓ one click', '~ basic checks', '~ some'],
  ['Layer-by-layer preview', '✓', '✕', '✓'],
  ['Use your own printer and rates', '✓', '✕ their machines', '✓'],
  ['Nothing to install', '✓ runs in the browser', '✓', '✕ desktop app'],
  ['Locked quote with an ID', '✓ 30 days', '✓', '✕'],
];

export default function Home() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => go('/')}>
          <span className="logo" aria-hidden="true">M</span>
          <div>
            <h1>3D Manufacturing Quote Engine</h1>
            <p>Instant 3D printing &amp; CNC quotes</p>
          </div>
        </div>
        <button className="primary small" onClick={() => go('/app')}>Open the app →</button>
      </header>

      <main className="landing single">
        <section className="hero">
          <div>
            <span className="pill">✨ Free instant quotes</span>
            <h2>
              Get a price for your 3D part <em>in seconds</em>.
            </h2>
            <p>
              Upload a 3D model and see what it costs to 3D print or CNC machine, how long it takes, and whether it will
              print cleanly on your printer.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => go('/app')}>Open the app →</button>
              <button className="ghost" onClick={() => go('/app?sample=1')}>Try a sample part</button>
            </div>
            <div className="trust">
              <span>No sign-up</span>
              <span>Files stay in your browser</span>
              <span>3D print + CNC</span>
            </div>
          </div>
          <QuotePreview />
        </section>

        <section>
          <div className="section-title">
            <h3>Why use it</h3>
            <p>Everything a quote needs, in one page.</p>
          </div>
          <div className="pros">
            {PROS.map((p) => (
              <div key={p.title} className="step">
                <div className="step-icon" style={{ background: 'var(--accent-soft)' }} aria-hidden="true">{p.icon}</div>
                <h4>{p.title}</h4>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title">
            <h3>How it compares</h3>
            <p>Against the usual ways of getting a price.</p>
          </div>
          <div className="card table-wrap">
            <table className="quote compare">
              <thead>
                <tr><th></th><th className="us">This app</th><th>Online quote sites</th><th>Desktop slicers</th></tr>
              </thead>
              <tbody>
                {COMPARE.map(([feature, ...cells]) => (
                  <tr key={feature}>
                    <td>{feature}</td>
                    {cells.map((c, i) => (
                      <td key={i} className={`${i === 0 ? 'us' : ''} ${c.startsWith('✓') ? 'yes' : c.startsWith('✕') ? 'no' : 'part'}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
            <h3>Works with your printer</h3>
            <p>Pick one of these or add your own.</p>
          </div>
          <div className="printer-chips">
            {PRESET_PRINTERS.filter((p) => p.id !== 'generic').map((p) => (
              <span key={p.id}>{p.name}<small>{p.x}×{p.y}×{p.z} mm</small></span>
            ))}
            <span className="add">+ your own</span>
          </div>
        </section>

        <section className="cta card">
          <h3>Ready to price your part?</h3>
          <p>Drop in an STL and get a quote in seconds.</p>
          <button className="primary" onClick={() => go('/app')}>Open the app →</button>
        </section>

        <footer className="footer">
          Prices are illustrative small-shop rates. Built with React, Three.js and Node.
        </footer>
      </main>
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
