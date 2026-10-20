import { useState } from 'react';

// Shown after saving: the quote is stored on the server with an ID and an expiry date,
// and its price was calculated by the server from the mesh, not taken from the browser.
export default function LockedQuote({ quote }) {
  const [copied, setCopied] = useState(false);
  const until = new Date(quote.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="locked">
      <div className="locked-id">
        <span className="lock" aria-hidden="true">🔒</span>
        <div>
          <strong>Quote {quote.quoteId}</strong>
          <span>Price locked until {until}</span>
        </div>
        <button
          className="fix"
          onClick={() => navigator.clipboard?.writeText(quote.quoteId).then(() => setCopied(true))}
        >
          {copied ? 'Copied' : 'Copy ID'}
        </button>
      </div>
      <p>
        ✓ Price re-calculated by the server from your mesh
        {quote.matchesPreview === false && ' (it differs slightly from the preview, and the locked price is the one that counts)'}.
        {quote.storage === 'memory' && ' Stored in server memory (add MONGO_URI to keep it after restarts).'}
      </p>
    </div>
  );
}
