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
    </div>
  );
}
