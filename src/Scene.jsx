// src/Scene.jsx
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';

export default function Scene() {
  return (
    <Canvas>
      {/* Light Source */}
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      
      {/* 3D Object (A spinning cube) */}
      <Box args={[1, 1, 1]}>
        <meshStandardMaterial color="hotpink" />
      </Box>
      
      {/* Camera Controls */}
      <OrbitControls />
    </Canvas>
  );
}
