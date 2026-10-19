import { useEffect, useState } from 'react';
import axios from 'axios';
import ModelViewer from './ModelViewer.jsx';
import * as THREE from 'three';
import { parseStl } from './engine/parseStl.js';
const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [status, setStatus] = useState('checking...');
  const [file, setFile] = useState(null);
  const [geometry, setGeometry] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/health`)
      .then(() => setStatus('connected'))
      .catch(() => setStatus('not reachable'));
  }, []);
  async function handleFile(e) {
    const picked = e.target.files[0];
    if (!picked) return;
    setFile(picked);

    const buffer = await picked.arrayBuffer();
    const positions = parseStl(buffer);
    console.log('triangles:', positions.length / 9);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    geo.center();
    geo.computeBoundingSphere();
    setGeometry(geo);
  }

  return (
    <main>
      <h1>3D Print / CNC Cost Estimator</h1>
      <p>Backend: {status}</p>
      <input type="file" accept=".stl" onChange={handleFile} />
      {geometry && <ModelViewer geometry={geometry} />}

{file && (
  <p>
    {file.name} · {(file.size / 1024).toFixed(1)} KB
  </p>
)}
    </main>
  );
}
