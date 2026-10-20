export default function MeshHealth({ validation, inverted }) {
  const v = validation;
  const problems = [
    v.boundaryEdges && `${v.boundaryEdges.toLocaleString()} open edges (holes)`,
    v.nonManifoldEdges && `${v.nonManifoldEdges.toLocaleString()} non-manifold edges`,
    v.flippedEdges && `${v.flippedEdges.toLocaleString()} edges between flipped faces`,
    v.degenerateTriangles && `${v.degenerateTriangles.toLocaleString()} zero-area triangles`,
    inverted && 'normals point inward (inside-out mesh)',
  ].filter(Boolean);

  if (problems.length === 0) {
    return (
      <div className="health ok">
        <strong>✓ Watertight mesh</strong>
        <span>Every edge is shared by exactly two faces. Volume and estimates are reliable.</span>
      </div>
    );
  }
  return (
    <div className={`health ${v.watertight ? 'warn' : 'bad'}`}>
      <strong>{v.watertight ? '⚠ Mesh has minor issues' : '⚠ Mesh is not watertight'}</strong>
      <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      <span>Problem edges are drawn in red. {v.watertight ? '' : 'Volume may be slightly off.'}</span>
    </div>
  );
}
