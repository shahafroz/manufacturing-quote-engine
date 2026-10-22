import { money, duration } from '../format.js';

export default function QuoteTable({ rows, recommended, quantity }) {
  if (!rows?.length) return null;
  // one tag each, even when several options tie
  const cheapestId = rows.reduce((a, b) => (b.total < a.total ? b : a)).id;
  const fastestId = rows.reduce((a, b) => (b.leadTimeHours < a.leadTimeHours ? b : a)).id;
  return (
    <div className="table-wrap">
      <table className="quote">
        <thead>
          <tr>
            <th>Material</th>
            <th>Process</th>
            <th className="num">Weight</th>
            <th className="num">Machine time</th>
            <th className="num">Per part</th>
            <th className="num">Total ×{quantity}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.id === recommended ? 'recommended' : ''}>
              <td>
                {r.name}
                {r.id === cheapestId && <span className="tag green">cheapest</span>}
                {r.id === fastestId && <span className="tag blue">fastest</span>}
                {r.id === recommended && <span className="tag violet">AI pick</span>}
                {r.discountPct > 0 && <span className="tag amber">−{r.discountPct}% qty</span>}
                {r.warning && <span className="warn-text">⚠ {r.warning}</span>}
              </td>
              <td>{r.process === 'fdm' ? '3D print' : 'CNC'}</td>
              <td className="num">{r.weightG.toFixed(1)} g</td>
              <td className="num">{duration(r.machineMinutes * 60)}</td>
              <td className="num">{money(r.perPart)}</td>
              <td className="num strong">{money(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some((r) => r.minimumApplied) && (
        <p className="note">Orders under the $5 minimum are rounded up to $5.</p>
      )}
      {quantity < 10 && <p className="note">Order 10+ for 5% off, 25+ for 10%, 50+ for 15%, 100+ for 20%.</p>}
    </div>
  );
}
