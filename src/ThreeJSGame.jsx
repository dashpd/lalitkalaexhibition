import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';

import { Capsule } from 'three/addons/math/Capsule.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';


function initThreeJS() {
    const clock = new THREE.Clock();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x88ccee, 0, 50);

    const container = document.getElementById('gamecontainer');

    const camera = new THREE.PerspectiveCamera(80, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.rotation.order = 'YXZ';

    const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
    fillLight1.position.set(2, 1, 1);
    scene.add(fillLight1);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    //directionalLight.position.set(- 5, 25, - 1);
    //directionalLight.castShadow = true;
    //directionalLight.shadow.camera.near = 0.01;
    //directionalLight.shadow.camera.far = 500;
    //directionalLight.shadow.camera.right = 30;
    //directionalLight.shadow.camera.left = - 30;
    //directionalLight.shadow.camera.top = 30;
    //directionalLight.shadow.camera.bottom = - 30;
    //directionalLight.shadow.mapSize.width = 1024;
    //directionalLight.shadow.mapSize.height = 1024;
    //directionalLight.shadow.radius = 4;
    //directionalLight.shadow.bias = - 0.00006;
    scene.add(directionalLight);


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setAnimationLoop(animate);
    // renderer.shadowMap.enabled = true;
   // renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // const stats = new Stats();
    // stats.domElement.style.position = 'absolute';
    // stats.domElement.style.top = '0px';
    // container.appendChild( stats.domElement );

    const GRAVITY = 15;

    const NUM_SPHERES = 100;
    const SPHERE_RADIUS = 0.1;

    const STEPS_PER_FRAME = 5;

    const sphereGeometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5);
    const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xdede8d });

    const spheres = [];
    let sphereIdx = 0;

    for (let i = 0; i < NUM_SPHERES; i++) {

        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true;
        sphere.receiveShadow = true;

        scene.add(sphere);

        spheres.push({
            mesh: sphere,
            collider: new THREE.Sphere(new THREE.Vector3(0, - 100, 0), SPHERE_RADIUS),
            velocity: new THREE.Vector3()
        });

    }

    const worldOctree = new Octree();

    const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1.6, 0), 0.35);

    const playerVelocity = new THREE.Vector3();
    const playerDirection = new THREE.Vector3();

    let playerOnFloor = false;
    let mouseTime = 0;

    const keyStates = {};

    const vector1 = new THREE.Vector3();
    const vector2 = new THREE.Vector3();
    const vector3 = new THREE.Vector3();

    document.addEventListener('keydown', (event) => {

        keyStates[event.code] = true;

    });

    document.addEventListener('keyup', (event) => {

        keyStates[event.code] = false;

    });

    container.addEventListener('mousedown', () => {

        document.body.requestPointerLock();

        mouseTime = performance.now();

    });

    document.addEventListener('mouseup', () => {

        if (document.pointerLockElement !== null) throwBall();

    });

    document.body.addEventListener('mousemove', (event) => {

        if (document.pointerLockElement === document.body) {

            camera.rotation.y -= event.movementX / 500;
            camera.rotation.x -= event.movementY / 500;

        }

    });

    window.addEventListener('resize', onWindowResize);

    function onWindowResize() {

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(container.clientWidth, container.clientHeight);

    }

    function throwBall() {

        const sphere = spheres[sphereIdx];

        camera.getWorldDirection(playerDirection);

        sphere.collider.center.copy(playerCollider.end).addScaledVector(playerDirection, playerCollider.radius * 1.5);

        // throw the ball with more force if we hold the button longer, and if we move forward

        const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));

        sphere.velocity.copy(playerDirection).multiplyScalar(impulse);
        sphere.velocity.addScaledVector(playerVelocity, 2);

        sphereIdx = (sphereIdx + 1) % spheres.length;

    }

    function playerCollisions() {

        const result = worldOctree.capsuleIntersect(playerCollider);

        playerOnFloor = false;

        if (result) {

            playerOnFloor = result.normal.y > 0;

            if (!playerOnFloor) {

                playerVelocity.addScaledVector(result.normal, - result.normal.dot(playerVelocity));

            }

            if (result.depth >= 1e-10) {

                playerCollider.translate(result.normal.multiplyScalar(result.depth));

            }

        }

    }

    function updatePlayer(deltaTime) {

        let damping = Math.exp(- 4 * deltaTime) - 1;

        if (!playerOnFloor) {

            playerVelocity.y -= GRAVITY * deltaTime;

            // small air resistance
            damping *= 0.1;

        }

        playerVelocity.addScaledVector(playerVelocity, damping);

        const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
        playerCollider.translate(deltaPosition);

        playerCollisions();

        camera.position.copy(playerCollider.end);

    }

    function playerSphereCollision(sphere) {

        const center = vector1.addVectors(playerCollider.start, playerCollider.end).multiplyScalar(0.5);

        const sphere_center = sphere.collider.center;

        const r = playerCollider.radius + sphere.collider.radius;
        const r2 = r * r;

        // approximation: player = 3 spheres

        for (const point of [playerCollider.start, playerCollider.end, center]) {

            const d2 = point.distanceToSquared(sphere_center);

            if (d2 < r2) {

                const normal = vector1.subVectors(point, sphere_center).normalize();
                const v1 = vector2.copy(normal).multiplyScalar(normal.dot(playerVelocity));
                const v2 = vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

                playerVelocity.add(v2).sub(v1);
                sphere.velocity.add(v1).sub(v2);

                const d = (r - Math.sqrt(d2)) / 2;
                sphere_center.addScaledVector(normal, - d);

            }

        }

    }

    function spheresCollisions() {

        for (let i = 0, length = spheres.length; i < length; i++) {

            const s1 = spheres[i];

            for (let j = i + 1; j < length; j++) {

                const s2 = spheres[j];

                const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
                const r = s1.collider.radius + s2.collider.radius;
                const r2 = r * r;

                if (d2 < r2) {

                    const normal = vector1.subVectors(s1.collider.center, s2.collider.center).normalize();
                    const v1 = vector2.copy(normal).multiplyScalar(normal.dot(s1.velocity));
                    const v2 = vector3.copy(normal).multiplyScalar(normal.dot(s2.velocity));

                    s1.velocity.add(v2).sub(v1);
                    s2.velocity.add(v1).sub(v2);

                    const d = (r - Math.sqrt(d2)) / 2;

                    s1.collider.center.addScaledVector(normal, d);
                    s2.collider.center.addScaledVector(normal, - d);

                }

            }

        }

    }

    function updateSpheres(deltaTime) {

        spheres.forEach(sphere => {

            sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);

            const result = worldOctree.sphereIntersect(sphere.collider);

            if (result) {

                sphere.velocity.addScaledVector(result.normal, - result.normal.dot(sphere.velocity) * 1.5);
                sphere.collider.center.add(result.normal.multiplyScalar(result.depth));

            } else {

                sphere.velocity.y -= GRAVITY * deltaTime;

            }

            const damping = Math.exp(- 1.5 * deltaTime) - 1;
            sphere.velocity.addScaledVector(sphere.velocity, damping);

            playerSphereCollision(sphere);

        });

        spheresCollisions();

        for (const sphere of spheres) {

            sphere.mesh.position.copy(sphere.collider.center);

        }

    }

    function getForwardVector() {

        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();

        return playerDirection;

    }

    function getSideVector() {

        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        playerDirection.cross(camera.up);

        return playerDirection;

    }

    function controls(deltaTime) {

        // gives a bit of air control
        const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

        if (keyStates['KeyW']) {

            playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));

        }

        if (keyStates['KeyS']) {

            playerVelocity.add(getForwardVector().multiplyScalar(- speedDelta));

        }

        if (keyStates['KeyA']) {

            playerVelocity.add(getSideVector().multiplyScalar(- speedDelta));

        }

        if (keyStates['KeyD']) {

            playerVelocity.add(getSideVector().multiplyScalar(speedDelta));

        }

        if (playerOnFloor) {

            if (keyStates['KeyZ']) {

                playerVelocity.y = 15;

            }

        }

    }
    const customShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            // You can define uniforms here, e.g., a color uniform
            u_time: { value: 0.0 }, // A uniform for animation
            u_color: { value: new THREE.Color(0xff0000) },
        },
        vertexShader: `
            // Vertex shader GLSL code goes here
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            // Fragment shader GLSL code goes here
            uniform vec3 u_color;
            uniform float u_time;
            void main() {
                gl_FragColor = vec4(u_color.x * sin(u_time * 0.01), u_color.yz, 1.0);
            }
        `,
    });

    const optimizedShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            // A uniform to control the color of the light
            u_lightColor: { value: new THREE.Color(0xffffff) },
            // A uniform to set the direction of the light
            u_lightDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() }
        },
        vertexShader: `
            // Pass the normal to the fragment shader
            varying vec3 vNormal;

            void main() {
            // Pass the normal in view space for correct lighting calculations
            vNormal = normalize(normalMatrix * normal);

            // Standard projection
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            // Set a moderate precision for better performance on mobile
            precision mediump float;

            varying vec3 vNormal;

            uniform vec3 u_lightColor;
            uniform vec3 u_lightDir;

            void main() {
                // Calculate the diffuse light intensity using the dot product
                // Clamping with max(0.0, ...) ensures no negative lighting
                float diffuseIntensity = max(0.0, dot(vNormal, u_lightDir));

                // Map the normal components from [-1, 1] to [0, 1] for a color base
                vec3 normalColor = vNormal * 0.5 + 0.5;

                // Combine the normal color with the diffuse light
                vec3 finalColor = normalColor * u_lightColor * diffuseIntensity;

                // Set the final color
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    });
    
    const normalShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            // You can define uniforms here, e.g., a color uniform
            u_time: { value: 0.0 }, // A uniform for animation
            // u_color: { value: new THREE.Color(0xff0000) },
        },
        vertexShader: `
        varying vec3 vNormal;

        void main() {
            vNormal = normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,

        fragmentShader: `
        varying vec3 vNormal;
        uniform float u_time;

        void main() {
            // Map the normal components from [-1, 1] to [0, 1] for color
            vec3 normalColor = vNormal * 0.5 + 0.5;
            gl_FragColor = vec4(normalColor.x * (1.0 - 0.5 * sin(u_time * 0.5)) , normalColor.yz * , 1.0);
        }
        `
    });

    // Define your custom material
    const customLambertianMaterial = new THREE.ShaderMaterial({
    uniforms: {
        // Base color of the object
        u_baseColor: { value: new THREE.Color(0.8, 0.4, 0.2) }, // Example: a brownish-orange color
        // Color of the light source
        u_lightColor: { value: new THREE.Color(1.0, 1.0, 1.0) }, // White light
        // Normalized direction of the light source (from surface to light)
        // IMPORTANT: This needs to be updated if your light moves or rotates!
        u_lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
        // A small ambient light factor to ensure surfaces not directly lit are still visible
        u_ambientFactor: { value: 0.1 }
    },
    vertexShader: `
        // We need to pass the normal to the fragment shader
        varying vec3 vNormal;

        void main() {
        // Transform the normal from model space to view space (camera space)
        // This is crucial for lighting calculations if the light direction is in view space
        // For simplicity, here we'll transform it to world space and then normalize
        // For a directional light, world space normals are often sufficient.
        vNormal = normalize(mat3(modelMatrix) * normal);

        // Standard vertex position transformation
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        // Set medium precision for floats for better performance on mobile/lower-end GPUs
        precision mediump float;

        // Receive the interpolated normal from the vertex shader
        varying vec3 vNormal;

        // Receive uniform values (light color, direction, object base color, ambient factor)
        uniform vec3 u_baseColor;
        uniform vec3 u_lightColor;
        uniform vec3 u_lightDirection;
        uniform float u_ambientFactor;

        void main() {
        // Normalize the interpolated normal (it might not be perfectly normalized after interpolation)
        vec3 normalizedNormal = normalize(vNormal);

        // Calculate the diffuse light component (Lambertian model)
        // dot product gives us the cosine of the angle between normal and light direction
        // max(0.0, ...) ensures light intensity is never negative (no light from behind the surface)
        float diffuseIntensity = max(0.0, dot(normalizedNormal, u_lightDirection));

        // Calculate the diffuse color
        vec3 diffuseColor = u_baseColor * u_lightColor * diffuseIntensity;

        // Add a small ambient component so unlit sides aren't completely black
        vec3 ambientColor = u_baseColor * u_ambientFactor;

        // Combine ambient and diffuse components
        vec3 finalColor = ambientColor + diffuseColor;

        // Set the final fragment color
        gl_FragColor = vec4(finalColor, 1.0);
        }
    `,
    side: THREE.DoubleSide // Optional: Render both sides of the faces
    });


    // To apply this material to your GLB model:
    // loader.load('path/to/your/model.glb', (gltf) => {
    //   gltf.scene.traverse((child) => {
    //     if (child.isMesh) {
    //       child.material = customLambertianMaterial;
    //     }
    //   });
    //   scene.add(gltf.scene);
    // });

    const proceduralNoiseMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_time: { value: 0.0 },
        u_baseColor: { value: new THREE.Color(0.2, 0.4, 0.8) },
        u_noiseScale: { value: 5.0 }, // Controls the "zoom" of the noise
    },
    vertexShader: `
    // New: pass the world-space position
    varying vec3 vPosition;

    void main() {
        // Transform the vertex position to world space
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

        // Standard vertex position transformation
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float u_time;
    uniform vec3 u_baseColor;
    uniform float u_noiseScale;

    // A robust and correct GLSL noise implementation
    // Source: https://github.com/ashima/webgl-noise/blob/master/src/classicnoise3D.glsl
    vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
    return mod289(((x*34.0)+1.0)*x);
    }

    vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
    }

    vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
    }

    float cnoise(vec3 P) {
    vec3 Pi = floor(P);
    vec3 Pf = fract(P);

    vec3 Px = Pi + vec3(1.0, 0.0, 0.0);
    vec3 Py = Pi + vec3(0.0, 1.0, 0.0);
    vec3 Pz = Pi + vec3(0.0, 0.0, 1.0);
    vec3 Pxy = Pi + vec3(1.0, 1.0, 0.0);
    vec3 Pxz = Pi + vec3(1.0, 0.0, 1.0);
    vec3 Pyz = Pi + vec3(0.0, 1.0, 1.0);
    vec3 Pxyz = Pi + vec3(1.0, 1.0, 1.0);
    
    Pi = mod289(Pi);
    Px = mod289(Px);
    Py = mod289(Py);
    Pz = mod289(Pz);
    Pxy = mod289(Pxy);
    Pxz = mod289(Pxz);
    Pyz = mod289(Pyz);
    Pxyz = mod289(Pxyz);

    vec4 i_x = vec4(Pi.x, Px.x, Py.x, Pxy.x);
    vec4 i_y = vec4(Pi.y, Px.y, Py.y, Pxy.y);
    vec4 i_z = vec4(Pi.z, Px.z, Py.z, Pxy.z);
    vec4 i_w = vec4(Pxz.x, Pyz.x, Pxyz.x, Pz.x);
    
    vec4 ixy = permute(permute(i_x) + i_y);
    vec4 ixyz = permute(permute(ixy) + i_z);
    
    vec4 g_x = ixyz * (1.0 / 7.0);
    vec4 g_y = fract(floor(g_x) * (1.0 / 7.0)) - 0.5;
    vec4 g_z = fract(floor(g_x) * (1.0 / 49.0)) - 0.5;
    g_x = fract(g_x);

    vec4 g_norm = taylorInvSqrt(g_x*g_x + g_y*g_y + g_z*g_z);
    g_x *= g_norm;
    g_y *= g_norm;
    g_z *= g_norm;

    vec3 p0 = Pf;
    vec3 p1 = Pf - vec3(1.0, 0.0, 0.0);
    vec3 p2 = Pf - vec3(0.0, 1.0, 0.0);
    vec3 p3 = Pf - vec3(1.0, 1.0, 0.0);
    vec3 p4 = Pf - vec3(0.0, 0.0, 1.0);
    vec3 p5 = Pf - vec3(1.0, 0.0, 1.0);
    vec3 p6 = Pf - vec3(0.0, 1.0, 1.0);
    vec3 p7 = Pf - vec3(1.0, 1.0, 1.0);

    vec4 t0 = vec4(dot(g_x.x, p0.x), dot(g_y.x, p0.y), dot(g_z.x, p0.z), dot(g_x.y, p1.x));
    vec4 t1 = vec4(dot(g_y.y, p1.y), dot(g_z.y, p1.z), dot(g_x.z, p2.x), dot(g_y.z, p2.y));
    vec4 t2 = vec4(dot(g_z.z, p2.z), dot(g_x.w, p3.x), dot(g_y.w, p3.y), dot(g_z.w, p3.z));
    
    vec4 c0 = vec4(dot(g_x.x, p0.x), dot(g_y.x, p0.y), dot(g_z.x, p0.z), dot(g_x.y, p1.x));
    vec4 c1 = vec4(dot(g_y.y, p1.y), dot(g_z.y, p1.z), dot(g_x.z, p2.x), dot(g_y.z, p2.y));
    vec4 c2 = vec4(dot(g_z.z, p2.z), dot(g_x.w, p3.x), dot(g_y.w, p3.y), dot(g_z.w, p3.z));

    return dot(c0, c1);
    }
    void main() {
        // Use the world-space position for noise mapping
        vec3 noiseCoord = vPosition * u_noiseScale;

        // Add a time component to animate the noise
        noiseCoord += u_time;

        // Get the noise value
        float noiseValue = cnoise(noiseCoord);

        // Map the noise value to a color
        float colorFactor = smoothstep(0.0, 0.2, noiseValue);

        vec3 finalColor = mix(u_baseColor * 0.5, u_baseColor, colorFactor);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    ` 
    });

    const proceduralNoiseMaterial_2 = new THREE.ShaderMaterial({
    uniforms: {
        u_time: { value: 0.0 },
        u_baseColor: { value: new THREE.Color(0.2, 0.4, 0.8) },
        u_noiseScale: { value: 5.0 }, // Controls the "zoom" of the noise
    },
    vertexShader: `
    // New: pass the world-space position
    varying vec3 vPosition;

    void main() {
        // Transform the vertex position to world space
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

        // Standard vertex position transformation
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    precision mediump float;

    varying vec3 vPosition;

    uniform float u_time;
    uniform vec3 u_baseColor;
    uniform float u_noiseScale;

    // Hash function to create pseudo-random numbers
    float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
    }

    // 2D Worley noise function
    float worleyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = i + neighbor;
        vec2 pointPos = neighbor + hash(point) - f;
        
        float dist = length(pointPos);
        minDist = min(minDist, dist);
        }
    }
    
    return minDist;
    }

    void main() {
        vec2 noiseCoord = vPosition.xy * u_noiseScale;
        noiseCoord += u_time;

        float noiseValue = worleyNoise(noiseCoord);

        // Use smoothstep for a more defined look
        float colorFactor = smoothstep(0.0, 0.4, noiseValue);

        vec3 finalColor = mix(u_baseColor * 0.5, u_baseColor, colorFactor);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    ` 
    });

    const proceduralNoiseMaterial_layered = new THREE.ShaderMaterial({
    uniforms: {
        u_time: { value: 0.0 },
        u_baseColor: { value: new THREE.Color(0.2, 0.4, 0.8) },
        u_noiseScale: { value: 5.0 }, // Controls the "zoom" of the noise
    },
    vertexShader: `
    // New: pass the world-space position
    varying vec3 vPosition;

    void main() {
        // Transform the vertex position to world space
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

        // Standard vertex position transformation
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float u_time;
    uniform vec3 u_baseColor;
    uniform float u_noiseScale;

    // A robust and correct GLSL noise implementation
    // Source: https://github.com/ashima/webgl-noise/blob/master/src/classicnoise3D.glsl
    vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
    return mod289(((x*34.0)+1.0)*x);
    }

    vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
    }

    vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
    }

    float cnoise(vec3 P) {
    vec3 Pi = floor(P);
    vec3 Pf = fract(P);

    vec3 Px = Pi + vec3(1.0, 0.0, 0.0);
    vec3 Py = Pi + vec3(0.0, 1.0, 0.0);
    vec3 Pz = Pi + vec3(0.0, 0.0, 1.0);
    vec3 Pxy = Pi + vec3(1.0, 1.0, 0.0);
    vec3 Pxz = Pi + vec3(1.0, 0.0, 1.0);
    vec3 Pyz = Pi + vec3(0.0, 1.0, 1.0);
    vec3 Pxyz = Pi + vec3(1.0, 1.0, 1.0);
    
    Pi = mod289(Pi);
    Px = mod289(Px);
    Py = mod289(Py);
    Pz = mod289(Pz);
    Pxy = mod289(Pxy);
    Pxz = mod289(Pxz);
    Pyz = mod289(Pyz);
    Pxyz = mod289(Pxyz);

    vec4 i_x = vec4(Pi.x, Px.x, Py.x, Pxy.x);
    vec4 i_y = vec4(Pi.y, Px.y, Py.y, Pxy.y);
    vec4 i_z = vec4(Pi.z, Px.z, Py.z, Pxy.z);
    vec4 i_w = vec4(Pxz.x, Pyz.x, Pxyz.x, Pz.x);
    
    vec4 ixy = permute(permute(i_x) + i_y);
    vec4 ixyz = permute(permute(ixy) + i_z);
    
    vec4 g_x = ixyz * (1.0 / 7.0);
    vec4 g_y = fract(floor(g_x) * (1.0 / 7.0)) - 0.5;
    vec4 g_z = fract(floor(g_x) * (1.0 / 49.0)) - 0.5;
    g_x = fract(g_x);

    vec4 g_norm = taylorInvSqrt(g_x*g_x + g_y*g_y + g_z*g_z);
    g_x *= g_norm;
    g_y *= g_norm;
    g_z *= g_norm;

    vec3 p0 = Pf;
    vec3 p1 = Pf - vec3(1.0, 0.0, 0.0);
    vec3 p2 = Pf - vec3(0.0, 1.0, 0.0);
    vec3 p3 = Pf - vec3(1.0, 1.0, 0.0);
    vec3 p4 = Pf - vec3(0.0, 0.0, 1.0);
    vec3 p5 = Pf - vec3(1.0, 0.0, 1.0);
    vec3 p6 = Pf - vec3(0.0, 1.0, 1.0);
    vec3 p7 = Pf - vec3(1.0, 1.0, 1.0);

    vec4 t0 = vec4(dot(g_x.x, p0.x), dot(g_y.x, p0.y), dot(g_z.x, p0.z), dot(g_x.y, p1.x));
    vec4 t1 = vec4(dot(g_y.y, p1.y), dot(g_z.y, p1.z), dot(g_x.z, p2.x), dot(g_y.z, p2.y));
    vec4 t2 = vec4(dot(g_z.z, p2.z), dot(g_x.w, p3.x), dot(g_y.w, p3.y), dot(g_z.w, p3.z));
    
    vec4 c0 = vec4(dot(g_x.x, p0.x), dot(g_y.x, p0.y), dot(g_z.x, p0.z), dot(g_x.y, p1.x));
    vec4 c1 = vec4(dot(g_y.y, p1.y), dot(g_z.y, p1.z), dot(g_x.z, p2.x), dot(g_y.z, p2.y));
    vec4 c2 = vec4(dot(g_z.z, p2.z), dot(g_x.w, p3.x), dot(g_y.w, p3.y), dot(g_z.w, p3.z));

    return dot(c0, c1);
    }
    void main() {
        // Layer 1: Base noise with low frequency and high amplitude
        vec3 noiseCoord1 = vPosition * 0.5; // Larger scale
        noiseCoord1 += u_time * 0.1;
        float noise1 = cnoise(noiseCoord1);

        // Layer 2: A smaller, more detailed noise layer
        vec3 noiseCoord2 = vPosition * 3.0; // Smaller scale
        noiseCoord2 += u_time * 0.5;
        float noise2 = cnoise(noiseCoord2);

        // Combine the layers with a gain of 0.5 for the second octave
        float combinedNoise = noise1 + noise2 * 0.5;

        // Use smoothstep to define the color transition
        float colorFactor = smoothstep(0.0, 0.2, combinedNoise);

        vec3 finalColor = mix(u_baseColor * 0.5, u_baseColor, colorFactor);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
    ` 
    });
    // To animate the noise, update the uniform in your render loop:
    // proceduralNoiseMaterial.uniforms.u_time.value += 0.01;

    const loader = new GLTFLoader().setPath('./assets/models/');
    const dLoader = new DRACOLoader();
    dLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    // dLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dLoader);

    loader.load('Model.glb', (gltf) => {

        scene.add(gltf.scene);

        worldOctree.fromGraphNode(gltf.scene);

        gltf.scene.traverse(child => {

            if (child.isMesh) {
                console.log(child.geometry.attributes); 
                // child.castShadow = true;
                // child.receiveShadow = true;

                // if ( child.material.map ) {
                //     child.material.map.anisotropy = 4;
                // }

                // child.material = customShaderMaterial;
                // child.material = normalShaderMaterial;
                // child.material = optimizedShaderMaterial;

                // child.material = proceduralNoiseMaterial;
                // child.material = proceduralNoiseMaterial_layered;
                // child.material = proceduralNoiseMaterial_2;
                // child.material = customLambertianMaterial;
                const basicMaterial = new MeshBasicMaterial({
                    color: 0xff0000, // Green color
                    wireframe: true  // Optional: display as a wireframe
                });
                child.material = basicMaterial;      
            }

        });

        // const helper = new OctreeHelper( worldOctree );
        // helper.visible = false;
        // scene.add( helper );

        // const gui = new GUI( { width: 200 } );
        // gui.add( { debug: false }, 'debug' )
        //     .onChange( function ( value ) {

        //         helper.visible = value;

        //     } );

    });

    function teleportPlayerIfOob() {

        if (camera.position.y <= - 25) {

            playerCollider.start.set(0, 0.35, 0);
            playerCollider.end.set(0, 1, 0);
            playerCollider.radius = 0.35;
            camera.position.copy(playerCollider.end);
            camera.rotation.set(0, 0, 0);

        }

    }

    // function animate() {
    //     // requestAnimationFrame(animate);

    //     // Update the u_time uniform
    //     // customShaderMaterial.uniforms.u_time.value += 0.01;

    //     const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    //     customShaderMaterial.uniforms.u_time.value += deltaTime;
    //     // we look for collisions in substeps to mitigate the risk of
    //     // an object traversing another too quickly for detection.

    //     for (let i = 0; i < STEPS_PER_FRAME; i++) {

    //         controls(deltaTime);

    //         updatePlayer(deltaTime);

    //         updateSpheres(deltaTime);

    //         teleportPlayerIfOob();

    //     }
    //     // const animate = () => {
    //     //     requestAnimationFrame(animate);

    //     //     // Update the u_time uniform
    //     //     customShaderMaterial.uniforms.u_time.value += 0.01;

    //     //     // ... your other render loop logic
    //     //     renderer.render(scene, camera);
    //     // };

    //     // animate(); 
    //     renderer.render(scene, camera);

    //     // stats.update();
    // }

    // A helper function to manage the render loop
    function animate() {
        // 1. This line schedules the next frame. It is
        //    the most important part of the loop.
        // requestAnimationFrame(animate);

        // 2. All your per-frame updates go here.
        //    This includes game logic, uniform updates, etc.
        const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

        for (let i = 0; i < STEPS_PER_FRAME; i++) {
            // proceduralNoiseMaterial.uniforms.u_time.value += 0.01;
            customShaderMaterial.uniforms.u_time.value += 0.01;
            normalShaderMaterial.uniforms.u_time.value += 0.01;
            controls(deltaTime);
            updatePlayer(deltaTime);
            updateSpheres(deltaTime);
            teleportPlayerIfOob();
        }

        // 3. This is the final step: rendering the scene.
        renderer.render(scene, camera);
    }

    // 4. Make the initial call to start the loop.
    // animate();

    const resizeObserver = new ResizeObserver(entries => {
        // Loop over all observed entries (though we only have one here)
        for (let entry of entries) {
            // Check if the observed element is our container
            if (entry.target === container) {
                // Now call your resize function
                onWindowResize(); // Or a dedicated onContainerResize()
            }
        }
    });

    resizeObserver.observe(container);

    onWindowResize();
}

window.addEventListener('load', initThreeJS);

export default function ThreeJSGame() {
    const containerRef = useRef(null);

    useEffect(() => {
        const cleanup = setupGame(containerRef.current);
        return cleanup;
    }, []); 

    return (
        <div 
            ref={containerRef} 
            id="gamecontainer" 
            style={{ width: '100vw', height: '100vh', touchAction: 'none' }} 
        />
    );
}
