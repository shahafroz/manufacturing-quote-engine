import { useState } from 'react';
import { api, errorText } from '../api.js';

export default function Advisor({ summary, onPick }) {
  const [useCase, setUseCase] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function ask(e) {
    e.preventDefault();
    if (!useCase.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/api/recommend', { useCase, part: summary });
      setResult(data);
      onPick(data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3>AI material advisor</h3>
      <form className="advisor" onSubmit={ask}>
        <input
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          placeholder='What is the part for? e.g. "outdoor bracket holding 5 kg"'
          maxLength={300}
        />
        <button disabled={busy || !useCase.trim()}>{busy ? 'Thinking…' : 'Recommend'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <p className="advice">
          <strong>{result.materialName}</strong> ({result.process === 'fdm' ? '3D print' : 'CNC'}): {result.reason}
        </p>
      )}
    </section>
  );
}
