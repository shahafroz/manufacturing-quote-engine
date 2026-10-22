import { useEffect, useState } from 'react';
import { api, errorText } from '../api.js';
import { money } from '../format.js';
import { myQuoteIds } from '../myQuotes.js';

export default function History() {
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const ids = myQuoteIds();
    if (ids.length === 0) return setQuotes([]);
    api.get('/api/quotes', { params: { ids: ids.join(',') } })
      .then(({ data }) => setQuotes(data))
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!quotes) return <p className="muted">Loading…</p>;
  if (quotes.length === 0) return <p className="muted">No saved quotes yet. Analyze a part and click "Lock & save quote". Only quotes saved in this browser are shown here.</p>;

  return (
    <div className="table-wrap">
      <table className="quote">
        <thead>
          <tr><th>Quote</th><th>Status</th><th>Date</th><th>File</th><th className="num">Volume</th><th>Cheapest option</th><th className="num">Qty</th><th className="num">Price</th></tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const best = q.rows?.reduce((a, b) => (b.total < a.total ? b : a), q.rows[0]);
            return (
              <tr key={q.quoteId || q._id || q.id}>
                <td className="mono">{q.quoteId || '–'}</td>
                <td>{q.valid ? <span className="tag green">valid</span> : <span className="tag">expired</span>}</td>
                <td>{new Date(q.createdAt).toLocaleString()}</td>
                <td>{q.fileName}</td>
                <td className="num">{(q.geometry.volume / 1000).toFixed(2)} cm³</td>
                <td>{best?.name}</td>
                <td className="num">{q.settings.quantity}</td>
                <td className="num strong">{best ? money(best.total) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
