import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import WeldUnit from "./WeldUnit";

// Studio lighting made from light panels, so no HDR file has to be downloaded
const Studio = () => (
  <>
    <ambientLight intensity={0.35} />
    <spotLight position={[4, 8, 5]} angle={0.3} penumbra={1} intensity={60} castShadow />
    <spotLight position={[-5, 3, -4]} angle={0.4} penumbra={1} intensity={25} color="#ff8a4c" />
    <Environment resolution={256}>
      <Lightformer form="rect" intensity={4} position={[0, 5, -6]} scale={[10, 3, 1]} />
      <Lightformer form="rect" intensity={2} position={[-6, 1, 1]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={2} position={[6, 1, 1]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer form="ring" intensity={3} color="#2997ff" position={[0, 3, 6]} scale={2} />
    </Environment>
  </>
);

// OrbitControls blocks page scrolling on phones. Allow vertical swipes to
// scroll the page; horizontal drags still rotate the model.
const Controls = ({ autoRotate, onInteract }) => {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current?.domElement;
    if (el) el.style.touchAction = "pan-y";
  });
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan={false}
      enableZoom={false}
      rotateSpeed={0.5}
      minPolarAngle={Math.PI / 2 - 0.45}
      maxPolarAngle={Math.PI / 2 + 0.2}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
      onStart={onInteract}
    />
  );
};

const Scene = ({ active, autoRotate, onInteract, ...unitProps }) => (
  <Canvas
    shadows
    dpr={[1, 2]}
    frameloop={active ? "always" : "never"}
    camera={{ position: [0, 0.8, 7.8], fov: 38 }}
    gl={{ antialias: true, alpha: true }}
  >
    <Studio />
    <WeldUnit {...unitProps} />
    <Controls autoRotate={autoRotate} onInteract={onInteract} />
  </Canvas>
);

export default Scene;
