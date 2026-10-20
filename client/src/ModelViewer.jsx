import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const BASE = new THREE.Color('#e8892b'); // part colour
const OVERHANG = new THREE.Color('#e5484d'); // faces that need support

// Draws the part with Z up (like the printer), sitting on the build plate at the origin.
// Optional layers: the overhang heatmap, mesh problems (red edges) and one sliced layer.
export default function ModelViewer({ positions, geometryInfo, overhangMask, showOverhangs, badEdges, layer }) {
  const { min, max, size } = geometryInfo.bbox;
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]];
  const radius = Math.max(...size) || 10;
  const dist = radius * 2.2;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const colors = new Float32Array(positions.length);
    for (let t = 0; t < positions.length / 9; t++) {
      const c = showOverhangs && overhangMask?.[t] ? OVERHANG : BASE;
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], t * 9 + k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, overhangMask, showOverhangs]);

  const edges = useMemo(() => {
    if (!badEdges || badEdges.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(badEdges, 3));
    return g;
  }, [badEdges]);

  // one sliced layer: turn each closed loop into line segments at its height
  const layerLines = useMemo(() => {
    if (!layer) return null;
    const pts = [];
    for (const loop of layer.loops) {
      const n = loop.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        pts.push(loop[i * 2], loop[i * 2 + 1], layer.z, loop[j * 2], loop[j * 2 + 1], layer.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [layer]);

  return (
    <Canvas
      key={positions.length + ':' + radius}
      camera={{ position: [dist, dist * 0.8, dist], near: radius / 100, far: radius * 100 }}
      gl={{ preserveDrawingBuffer: true }}
      className="viewer-canvas"
    >
      <color attach="background" args={['#14161a']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[radius * 2, radius * 3, radius * 1.5]} intensity={1.3} />
      <directionalLight position={[-radius * 2, radius, -radius * 2]} intensity={0.4} />
      <gridHelper args={[radius * 3, 30, '#3a3f47', '#262a30']} />

      {/* STL is Z-up, three.js is Y-up: rotate the whole scene -90° about X */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group position={[-center[0], -center[1], -center[2]]}>
          <mesh geometry={geometry}>
            <meshStandardMaterial
              vertexColors
              roughness={0.55}
              metalness={0.05}
              transparent={!!layer}
              opacity={layer ? 0.12 : 1}
              depthWrite={!layer}
            />
          </mesh>
          {edges && (
            <lineSegments geometry={edges}>
              <lineBasicMaterial color="#ff2d55" />
            </lineSegments>
          )}
          {layerLines && (
            <lineSegments geometry={layerLines}>
              <lineBasicMaterial color="#5ee0ff" />
            </lineSegments>
          )}
        </group>
      </group>
      <OrbitControls makeDefault target={[0, size[2] / 2, 0]} />
    </Canvas>
  );
}
