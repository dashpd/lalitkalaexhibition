// src/Scene.jsx

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Model from './Model'; // Import your new Model component

export default function Scene() {
  return (
    <Canvas camera={{ position: [5, 5, 5], fov: 75 }}>
      {/* 💡 Essential for handling asynchronous loading */}
      <Suspense fallback={<Text position={[0, 0, 0]}>Loading Model...</Text>}>
        <Model />
      </Suspense>

      {/* Lighting and Controls */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls />
    </Canvas>
  );
}
