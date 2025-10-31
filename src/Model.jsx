import React, { Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { useGLTF } from '@react-three/drei';

// This is the path to your compressed model file
const MODEL_PATH = 'public/assets/models/Model.glb'; 

// IMPORTANT: Define the DRACOLoader and set its path outside of the component 
// or setup hook to ensure it's only configured once.
// We use a CDN path for the decoder binaries for simplicity in this setup.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/'); 
// If you installed draco3d via npm, you could use a local path if properly configured:
// dracoLoader.setDecoderPath('./node_modules/draco3d/draco_decoder.wasm');

// Register the DRACOLoader instance with useGLTF (or the underlying GLTFLoader)
useGLTF.preload(MODEL_PATH, false, (loader) => {
    loader.setDRACOLoader(dracoLoader);
});


function Model() {
  // useGLTF is a convenience hook that internally uses useLoader(GLTFLoader, ...)
  // It automatically sets up caching and handles the load state.
  const gltf = useGLTF(MODEL_PATH); 

  // The 'gltf' object contains the 3D scene data
  return (
    // <primitive> is used to render a raw Three.js object inside a R3F component
    <primitive object={gltf.scene} scale={1} />
  );
}

export default Model;
