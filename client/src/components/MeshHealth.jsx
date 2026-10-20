export default function MeshHealth({ validation, inverted, report, onRepair, busy }) {
  const v = validation;
  const problems = [
    v.boundaryEdges && `${v.boundaryEdges.toLocaleString()} open edges (holes)`,
    v.nonManifoldEdges && `${v.nonManifoldEdges.toLocaleString()} non-manifold edges`,
    v.flippedEdges && `${v.flippedEdges.toLocaleString()} edges between flipped faces`,
    v.degenerateTriangles && `${v.degenerateTriangles.toLocaleString()} zero-area triangles`,
    inverted && 'normals point inward (inside-out mesh)',
  ].filter(Boolean);

  const fixed = report && [
    report.holesFilled && `closed ${report.holesFilled} hole${report.holesFilled > 1 ? 's' : ''} (${report.trianglesAdded} triangles)`,
    report.facesFlipped && `flipped ${report.facesFlipped} faces`,
    report.partsTurnedRightSideOut && `turned ${report.partsTurnedRightSideOut} inside-out piece${report.partsTurnedRightSideOut > 1 ? 's' : ''} right side out`,
    report.degenerateRemoved && `removed ${report.degenerateRemoved} zero-area triangles`,
  ].filter(Boolean);

  if (problems.length === 0) {
    return (
      <div className="health ok">
        <strong>✓ {report?.changed ? 'Mesh repaired and watertight' : 'Watertight mesh'}</strong>
        <span>
          {fixed?.length ? `Repairs: ${fixed.join(', ')}. Added faces are shown in green.` : 'Every edge is shared by exactly two faces. Volume and estimates are reliable.'}
        </span>
      </div>
    );
  }
  return (
    <div className={`health ${v.watertight ? 'warn' : 'bad'}`}>
      <strong>{v.watertight ? '⚠ Mesh has minor issues' : '⚠ Mesh is not watertight'}</strong>
      <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      <span>Problem edges are drawn in red. {v.watertight ? '' : 'Volume may be slightly off.'}</span>
      {report?.holesSkipped > 0 && <span>{report.holesSkipped} hole(s) were too complex to close automatically.</span>}
      <div className="fix-row">
        <button className="fix strong" onClick={onRepair} disabled={busy}>{busy ? 'Repairing…' : 'Repair automatically'}</button>
      </div>
    </div>
  );
}
