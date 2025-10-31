import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Text, KeyboardControls, useKeyboardControls, useProgress } from '@react-three/drei'; 
import * as THREE from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js'; 
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'; 

// --- Configuration Constants ---
// FIX: Changed from absolute path ('/assets/...') to relative path ('./assets/...')
// This ensures the browser looks inside the current repository subfolder on GitHub Pages.
const MODEL_PATH = './assets/models/Model.glb'; 
// useGLTF defaults to this CDN for Draco, making the code cleaner:
const DRACO_PATH = 'https://www.gstatic.com/draco/v1/decoders/'; 

const GRAVITY = 30; 
const JUMP_VELOCITY = 15;
const SPEED = 5;

// --- Key Mapping for useKeyboardControls ---
const controlsMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
];

// --- Loader Component (Shows Download progress and Processing status) ---
function Loader({ isOctreeReady }) {
  const { progress } = useProgress();
  
  let statusText = `Downloading Environment: ${progress.toFixed(0)}%`;
  let color = "#1e90ff"; // Dodger Blue for download

  if (progress === 100 && !isOctreeReady) {
    statusText = "Processing Collisions (Octree Build)...";
    color = "#ff4500"; // Orange-Red for processing
  } else if (progress === 100 && isOctreeReady) {
      statusText = "Ready! Click to start.";
      color = "#32cd32"; // Lime Green for ready
  }

  return (
    <Text 
      color={color} 
      fontSize={0.5} 
      position={[0, 0, -2]} 
      anchorX="center" 
      anchorY="middle"
      maxWidth={5} // Prevent text from being too wide
    >
      {statusText}
    </Text>
  );
}


// --- 1. Model Component and Physics Setup ---
function GameEnvironment({ setOctree, setIsOctreeReady }) {
    
    // Pass the DRACO_PATH directly as the second argument for reliable decompression
    const { scene } = useGLTF(MODEL_PATH, DRACO_PATH); 

    useEffect(() => {
        if (scene) {
            // Ensure shadows are set up 
            scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Wrap the HEAVY Octree construction in an async Promise/setTimeout 
            // to prevent the browser from freezing during calculation.
            const buildOctreeAsync = () => new Promise(resolve => {
                setTimeout(() => {
                    console.log('Starting Octree build...');
                    const octree = new Octree();
                    octree.fromGraphNode(scene);
                    console.log('Octree build complete.');
                    resolve(octree);
                }, 0); 
            });

            buildOctreeAsync().then(octree => {
                setOctree(octree);
                setIsOctreeReady(true);
            });
        }
    }, [scene, setOctree, setIsOctreeReady]);

    // This component renders the model as soon as it's downloaded
    return (
        <primitive object={scene} scale={1} castShadow receiveShadow />
    );
}


// --- 2. FPS Control and Physics Loop ---
function PlayerControls({ octree, isOctreeReady }) {
    const { camera, gl } = useThree();
    
    useEffect(() => {
        camera.position.set(0, 2, 0); 
        camera.rotation.order = 'YXZ'; 
    }, [camera]);

    const [subscribeKeys, getKeys] = useKeyboardControls(); 
    const playerCollider = useMemo(() => 
        new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1.6, 0), 0.35)
    , []);
    
    // Set initial position
    playerCollider.end.set(0, 10, 0); 
    playerCollider.start.set(0, 10 - 1.25, 0); 

    const playerVelocity = useRef(new THREE.Vector3(0, 0, 0));
    const playerOnFloor = useRef(false);
    const playerDirection = useMemo(() => new THREE.Vector3(), []);
    
    // Setup for pointer lock control and camera rotation
    useEffect(() => {
        if (!isOctreeReady) return; // Wait until ready

        const handleMouseDown = () => {
            gl.domElement.requestPointerLock();
        };

        gl.domElement.addEventListener('mousedown', handleMouseDown);

        const handleMouseMove = (event) => {
            if (document.pointerLockElement === gl.domElement) {
                // Yaw (Y-axis rotation) 
                camera.rotation.y -= event.movementX / 500; 
                
                // Pitch (X-axis rotation, clamped)
                let pitchChange = event.movementY / 500;
                
                camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x - pitchChange));
                
                // CRITICAL FIX: Aggressively zero out the Z-axis rotation (Roll)
                camera.rotation.z = 0; 
            }
        };

        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            gl.domElement.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [camera, gl.domElement, isOctreeReady]); // Depend on isOctreeReady

    // --- Physics Helpers (Same as before) ---

    const getForwardVector = () => {
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        return playerDirection;
    };

    const getSideVector = () => {
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        playerDirection.cross(camera.up);
        return playerDirection;
    };
    
    const playerCollisions = () => {
        const result = octree.capsuleIntersect(playerCollider);
        playerOnFloor.current = false;

        if (result) {
            playerOnFloor.current = result.normal.y > 0.001;
            
            if (!playerOnFloor.current) {
                playerVelocity.current.addScaledVector(result.normal, - result.normal.dot(playerVelocity.current));
            }
            
            if (result.depth > 0) {
                 playerCollider.translate(result.normal.multiplyScalar(result.depth));
            }
        }
    };
    
    const updatePlayer = (deltaTime) => {
        let damping = Math.exp(- 4 * deltaTime) - 1;

        if (!playerOnFloor.current) {
            playerVelocity.current.y -= GRAVITY * deltaTime;
            damping *= 0.1;
        }

        playerVelocity.current.addScaledVector(playerVelocity.current, damping);

        const deltaPosition = playerVelocity.current.clone().multiplyScalar(deltaTime);
        playerCollider.translate(deltaPosition);

        playerCollisions();

        camera.position.copy(playerCollider.end); 
    };

    const controls = (deltaTime) => {
        const keys = getKeys();
        const speedDelta = deltaTime * SPEED;

        if (keys.forward) { playerVelocity.current.add(getForwardVector().multiplyScalar(speedDelta)); }
        if (keys.backward) { playerVelocity.current.add(getForwardVector().multiplyScalar(- speedDelta)); }
        if (keys.left) { playerVelocity.current.add(getSideVector().multiplyScalar(- speedDelta)); }
        if (keys.right) { playerVelocity.current.add(getSideVector().multiplyScalar(speedDelta)); }

        if (playerOnFloor.current && keys.jump) { 
            playerVelocity.current.y = JUMP_VELOCITY; 
        }
    };
    
    const teleportPlayerIfOob = () => {
        if (camera.position.y < - 25) {
            playerCollider.start.set(0, 10 - 1.25, 0); 
            playerCollider.end.set(0, 10, 0);
            playerVelocity.current.set(0, 0, 0);
            camera.rotation.set(0, 0, 0);
        }
    };

    // --- R3F Render Loop ---
    useFrame((_, deltaTime) => {
        if (!isOctreeReady) return; // Only run physics if Octree is ready

        const stepDelta = Math.min(0.05, deltaTime); 
        
        controls(stepDelta);
        updatePlayer(stepDelta);
        
        teleportPlayerIfOob();
    });

    return null;
}

// --- 3. Main Application Component (The unified App/Scene) ---
export default function FPSGame() {
    const [octree, setOctree] = useState(null);
    const [isOctreeReady, setIsOctreeReady] = useState(false);
    
    return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#111' }}>
            <KeyboardControls map={controlsMap}>
                <Canvas 
                    shadows 
                    camera={{ fov: 75, near: 0.1, far: 1000 }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {/* Scene Setup */}
                    <color attach="background" args={['#88ccee']} />
                    
                    {/* Lighting */}
                    <ambientLight intensity={1.5} />
                    <directionalLight 
                        position={[10, 20, 10]} 
                        intensity={2} 
                        castShadow
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                    />

                    {/* Model Loading (Suspense fallback renders the Loader component) */}
                    <Suspense fallback={<Loader isOctreeReady={isOctreeReady} />}>
                        
                        {/* 1. Load Model and trigger asynchronous Octree build */}
                        <GameEnvironment setOctree={setOctree} setIsOctreeReady={setIsOctreeReady} />
                        
                        {/* 2. Control Camera and run Physics loop (waits for Octree) */}
                        <PlayerControls octree={octree} isOctreeReady={isOctreeReady} />
                        
                    </Suspense>
                    <Loader isOctreeReady={isOctreeReady} />
                </Canvas>
            </KeyboardControls>
        </div>
    );
}

