"use client";

import { Grid } from "@react-three/drei";

export function GridFloor() {
  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#e7dfcf" roughness={1} />
      </mesh>
      <Grid
        args={[220, 220]}
        cellColor="#99a6b2"
        cellSize={4}
        cellThickness={0.5}
        fadeDistance={180}
        fadeStrength={1.7}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0.04, 0]}
        sectionColor="#607282"
        sectionSize={20}
        sectionThickness={1.25}
      />
    </>
  );
}
