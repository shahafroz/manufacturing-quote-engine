import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';


export default function ModelViewer({ geometry }) {
  const radius = geometry.boundingSphere.radius;
  const dist = radius * 2.5;

  return (
    <Canvas
      camera={{ position: [dist, dist, dist], near: radius / 100, far: radius * 100 }}
      style={{ height: 500, background: '#1e1e24' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[radius * 2, radius * 3, radius * 2]} intensity={1.2} />
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="orange" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}