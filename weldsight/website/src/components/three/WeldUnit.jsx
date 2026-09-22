import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/**
 * A 3D model of the WeldSight prototype, built from simple shapes so it needs
 * no model file. Proportions follow the prototype photos: an orange battery
 * housing at the bottom, stacked black plates, power and compute boards,
 * four antennas, and a camera on a pan-tilt head.
 *
 * Every layer eases toward its "exploded" height when `exploded` is true.
 */

// ---------- shared materials ----------
const useMaterials = (housingColor) =>
  useMemo(
    () => ({
      plate: new THREE.MeshStandardMaterial({ color: "#0c0c0c", roughness: 0.4, metalness: 0.3 }),
      matte: new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.8 }),
      housing: new THREE.MeshStandardMaterial({ color: housingColor, roughness: 0.45, metalness: 0.05 }),
      pcb: new THREE.MeshStandardMaterial({ color: "#1f6b3a", roughness: 0.6 }),
      pcbBlue: new THREE.MeshStandardMaterial({ color: "#1d3f7a", roughness: 0.6 }),
      chip: new THREE.MeshStandardMaterial({ color: "#0b0b0b", roughness: 0.35, metalness: 0.4 }),
      alu: new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.3, metalness: 0.9 }),
      copper: new THREE.MeshStandardMaterial({ color: "#b8733c", roughness: 0.35, metalness: 0.85 }),
      brass: new THREE.MeshStandardMaterial({ color: "#c9a44c", roughness: 0.3, metalness: 0.9 }),
      antenna: new THREE.MeshStandardMaterial({ color: "#0e0e0e", roughness: 0.4, metalness: 0.1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#0a1a3a", roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
      ribbon: new THREE.MeshStandardMaterial({ color: "#d88a2a", roughness: 0.6 }),
      led: new THREE.MeshStandardMaterial({ color: "#2997ff", emissive: "#2997ff", emissiveIntensity: 3 }),
      wireRed: new THREE.MeshStandardMaterial({ color: "#c0262d", roughness: 0.5 }),
      wireYellow: new THREE.MeshStandardMaterial({ color: "#e0b020", roughness: 0.5 }),
      wireBlack: new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.5 }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

// ---------- small building blocks ----------
const Plate = ({ y, m }) => (
  <mesh position={[0, y, 0]} material={m.plate} castShadow receiveShadow>
    <cylinderGeometry args={[1.12, 1.12, 0.05, 64]} />
  </mesh>
);

const Standoffs = ({ y, h, m }) =>
  [45, 135, 225, 315].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg);
    return (
      <mesh key={deg} position={[Math.cos(a) * 0.9, y + h / 2, Math.sin(a) * 0.9]} material={m.brass}>
        <cylinderGeometry args={[0.03, 0.03, h, 8]} />
      </mesh>
    );
  });

const Wire = ({ points, material, radius = 0.018 }) => {
  const key = JSON.stringify(points);
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(JSON.parse(key).map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, 40, radius, 8, false);
  }, [key, radius]);
  return <mesh geometry={geometry} material={material} />;
};

// A label pinned to a point on the model
const Hotspot = ({ position, part, active, onSelect, showLabel }) => (
  <Html position={position} center zIndexRange={[20, 0]}>
    <button
      onClick={() => onSelect(part.id)}
      aria-label={`${part.name}: show details`}
      className={`group flex items-center gap-2 whitespace-nowrap rounded-full transition-all duration-300 ${
        showLabel || active ? "pl-1.5 pr-3 py-1.5 bg-black/70 backdrop-blur border border-white/15" : "p-1.5"
      }`}
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full rounded-full bg-blue opacity-60 animate-ping" />
        <span className={`relative inline-flex h-3 w-3 rounded-full ${active ? "bg-white" : "bg-blue"}`} />
      </span>
      {(showLabel || active) && <span className="text-xs text-white font-medium">{part.name}</span>}
    </button>
  </Html>
);

// How far each layer rises when exploded
const EXPLODE = { base: 0, power: 0.4, compute: 0.9, top: 1.4, head: 1.9 };

const Layer = ({ offset, exploded, children }) => {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = exploded ? offset : 0;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, target, 4, dt);
  });
  return <group ref={ref}>{children}</group>;
};

// ---------- the model ----------
const WeldUnit = ({ exploded, housingColor, parts, activePart, onSelectPart }) => {
  const m = useMaterials(housingColor);
  const root = useRef();
  const pan = useRef();
  const tilt = useRef();
  const antennas = useRef([]);

  // keep the housing colour in sync without rebuilding materials
  m.housing.color.set(housingColor);

  const partById = Object.fromEntries(parts.map((p) => [p.id, p]));
  const hs = (id, position) => (
    <Hotspot
      position={position}
      part={partById[id]}
      active={activePart === id}
      showLabel={exploded}
      onSelect={onSelectPart}
    />
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // camera head slowly scans left/right and nods, like it's looking for a seam
    if (pan.current) pan.current.rotation.y = Math.sin(t * 0.6) * 0.6;
    if (tilt.current) tilt.current.rotation.x = Math.sin(t * 0.9) * 0.18 - 0.1;
    // blinking 5G link LED
    m.led.emissiveIntensity = 1.5 + Math.max(0, Math.sin(t * 5)) * 3;
    // antennas swing outward when exploded
    antennas.current.forEach((a) => {
      if (!a) return;
      const target = exploded ? -0.55 : -0.22; // negative = lean outward
      a.rotation.z = THREE.MathUtils.damp(a.rotation.z, target, 4, dt);
    });
    // keep the model centred as it grows taller
    if (root.current) {
      const targetY = exploded ? -2.1 : -1.35;
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, targetY, 4, dt);
    }
    // dolly the camera in close when assembled, back out when exploded
    const cam = state.camera;
    const dist = THREE.MathUtils.damp(cam.position.length(), exploded ? 9.2 : 6.6, 3, dt);
    cam.position.setLength(dist);
  });

  return (
    <group ref={root} position={[0, -1.35, 0]}>
      {/* soft shadow on the "floor", moves with the model */}
      <ContactShadows position={[0, -0.01, 0]} opacity={0.6} scale={6} blur={2.4} far={3} />
      {/* ===== Base: battery housing ===== */}
      <Layer offset={EXPLODE.base} exploded={exploded}>
        <Plate y={0.03} m={m} />
        <RoundedBox args={[1.35, 0.5, 1.0]} radius={0.06} position={[0, 0.31, 0]} material={m.housing} castShadow />
        {/* strap */}
        <mesh position={[0, 0.31, 0.505]} material={m.matte}>
          <boxGeometry args={[0.2, 0.52, 0.02]} />
        </mesh>
        {/* XT60-style connector on a lead */}
        <RoundedBox args={[0.16, 0.08, 0.1]} radius={0.015} position={[0.95, 0.12, 0.55]} material={m.wireYellow} />
        <Wire points={[[0.55, 0.25, 0.4], [0.8, 0.15, 0.5], [0.9, 0.12, 0.55]]} material={m.wireRed} />
        <Wire points={[[0.55, 0.22, 0.35], [0.82, 0.12, 0.48], [0.92, 0.1, 0.52]]} material={m.wireBlack} />
        {hs("battery", [0, 0.4, 0.6])}
      </Layer>

      {/* ===== Power stage ===== */}
      <Layer offset={EXPLODE.power} exploded={exploded}>
        <Standoffs y={0.06} h={0.54} m={m} />
        <Plate y={0.62} m={m} />
        <mesh position={[0, 0.67, 0]} material={m.pcb}>
          <boxGeometry args={[1.0, 0.04, 0.75]} />
        </mesh>
        {/* heatsink with fins */}
        <mesh position={[-0.1, 0.72, 0]} material={m.alu}>
          <boxGeometry args={[0.6, 0.04, 0.45]} />
        </mesh>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[-0.38 + i * 0.07, 0.8, 0]} material={m.alu}>
            <boxGeometry args={[0.02, 0.14, 0.45]} />
          </mesh>
        ))}
        {/* inductor */}
        <mesh position={[0.36, 0.76, 0.12]} rotation={[Math.PI / 2, 0, 0]} material={m.copper}>
          <torusGeometry args={[0.09, 0.04, 12, 24]} />
        </mesh>
        {/* capacitors */}
        {[-0.2, 0.2].map((z) => (
          <mesh key={z} position={[0.36, 0.76, z - 0.05]} material={m.pcbBlue}>
            <cylinderGeometry args={[0.04, 0.04, 0.12, 16]} />
          </mesh>
        ))}
        {hs("power", [0.3, 0.95, 0.35])}
      </Layer>

      {/* ===== Compute: Raspberry Pi + 5G modem + antennas ===== */}
      <Layer offset={EXPLODE.compute} exploded={exploded}>
        <Standoffs y={0.64} h={0.5} m={m} />
        <Plate y={1.15} m={m} />
        <mesh position={[0, 1.2, 0]} material={m.pcb}>
          <boxGeometry args={[0.85, 0.04, 0.56]} />
        </mesh>
        <mesh position={[-0.1, 1.24, 0]} material={m.chip}>
          <boxGeometry args={[0.18, 0.03, 0.18]} />
        </mesh>
        {/* USB / Ethernet ports */}
        {[-0.18, 0, 0.18].map((z) => (
          <mesh key={z} position={[0.38, 1.27, z]} material={m.alu}>
            <boxGeometry args={[0.14, 0.1, 0.13]} />
          </mesh>
        ))}
        {/* 5G modem board on its own standoffs */}
        <mesh position={[-0.05, 1.36, 0]} material={m.pcbBlue}>
          <boxGeometry args={[0.55, 0.03, 0.38]} />
        </mesh>
        <mesh position={[-0.05, 1.39, 0]} material={m.alu}>
          <boxGeometry args={[0.3, 0.025, 0.24]} />
        </mesh>
        {/* status LED */}
        <mesh position={[0.2, 1.39, 0.15]} material={m.led}>
          <sphereGeometry args={[0.025, 16, 16]} />
        </mesh>
        {/* antennas */}
        {[45, 135, 225, 315].map((deg, i) => {
          const a = THREE.MathUtils.degToRad(deg);
          return (
            <group
              key={deg}
              position={[Math.cos(a) * 0.98, 1.18, Math.sin(a) * 0.98]}
              rotation={[0, -a, 0]}
            >
              <group ref={(el) => (antennas.current[i] = el)} rotation={[0, 0, -0.22]}>
                <mesh position={[0, 0.06, 0]} material={m.alu}>
                  <cylinderGeometry args={[0.045, 0.045, 0.12, 12]} />
                </mesh>
                <mesh position={[0, 0.9, 0]} material={m.antenna} castShadow>
                  <capsuleGeometry args={[0.065, 1.45, 8, 16]} />
                </mesh>
              </group>
            </group>
          );
        })}
        {hs("compute", [-0.3, 1.5, 0.3])}
        {hs("antennas", [0.95, 2.2, 0.95])}
      </Layer>

      {/* ===== Top plate + servo housing ===== */}
      <Layer offset={EXPLODE.top} exploded={exploded}>
        <Standoffs y={1.17} h={0.45} m={m} />
        <Plate y={1.64} m={m} />
        <mesh position={[0, 1.9, 0]} material={m.plate} castShadow>
          <cylinderGeometry args={[0.42, 0.44, 0.46, 48]} />
        </mesh>
        <mesh position={[0, 2.14, 0]} material={m.matte}>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 32]} />
        </mesh>
      </Layer>

      {/* ===== Pan-tilt camera head ===== */}
      <Layer offset={EXPLODE.head} exploded={exploded}>
        <group ref={pan} position={[0, 2.16, 0]}>
          {/* U bracket */}
          <mesh position={[0, 0.02, 0]} material={m.matte}>
            <boxGeometry args={[0.42, 0.04, 0.18]} />
          </mesh>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.2, 0]} material={m.matte}>
              <boxGeometry args={[0.04, 0.36, 0.18]} />
            </mesh>
          ))}
          <group ref={tilt} position={[0, 0.3, 0]}>
            {/* camera board */}
            <mesh material={m.pcb}>
              <boxGeometry args={[0.34, 0.34, 0.03]} />
            </mesh>
            {/* lens */}
            <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={m.chip}>
              <cylinderGeometry args={[0.085, 0.1, 0.14, 32]} />
            </mesh>
            <mesh position={[0, 0, 0.152]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
              <cylinderGeometry args={[0.06, 0.06, 0.01, 32]} />
            </mesh>
            {/* ribbon cable */}
            <mesh position={[0, -0.28, -0.04]} rotation={[0.15, 0, 0]} material={m.ribbon}>
              <boxGeometry args={[0.14, 0.26, 0.008]} />
            </mesh>
          </group>
          {hs("camera", [0, 0.55, 0.2])}
        </group>
      </Layer>
    </group>
  );
};

export default WeldUnit;
