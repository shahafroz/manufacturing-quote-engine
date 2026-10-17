import { useEffect, useState } from 'react';
import axios from 'axios';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import ModelViewer from './ModelViewer.jsx';
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
    const geo = new STLLoader().parse(buffer);
    geo.center();
    geo.computeBoundingSphere();

    console.log('triangles:', geo.attributes.position.count / 3);
    console.log('radius:', geo.boundingSphere.radius);
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
