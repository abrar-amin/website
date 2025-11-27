<script>
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { perlin2D } from '@leodeslf/perlin-noise';

  let container;
  let scene, camera, renderer, planet;
  let cloudLayers = [];
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let rotation = { x: 0, y: 0 };

  // Helper function for tileable/periodic Perlin noise using 4D torus mapping
  function periodicNoise(x, y, wrapX, wrapY) {
    // Map 2D coordinates to 4D torus for seamless tiling
    // This ensures edges wrap around smoothly without seams
    const s = (x / wrapX) * 2 * Math.PI;
    const t = (y / wrapY) * 2 * Math.PI;

    const dx = Math.cos(s);
    const dy = Math.sin(s);
    const dz = Math.cos(t);
    const dw = Math.sin(t);

    // Sample noise from the 4D torus (using two 2D samples)
    // Scale the torus to avoid clustering at the center
    const radius = wrapX / (2 * Math.PI);
    return (perlin2D(dx * radius, dy * radius) + perlin2D(dz * radius, dw * radius)) / 2;
  }

  function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    const wrapSize = 4; // Size of the tiling domain

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Normalize coordinates for tiling
        const nx = (x / canvas.width) * wrapSize;
        const ny = (y / canvas.height) * wrapSize;

        let value = 0;
        value += periodicNoise(nx, ny, wrapSize, wrapSize) * 0.5;
        value += periodicNoise(nx * 2, ny * 2, wrapSize, wrapSize) * 0.25;
        value += periodicNoise(nx * 4, ny * 4, wrapSize, wrapSize) * 0.125;
        value += periodicNoise(nx * 8, ny * 8, wrapSize, wrapSize) * 0.0625;

        value = (value + 1) / 2; // Normalize from [-1,1] to [0,1]

        // Soft threshold for wispy clouds with smooth edges
        const threshold = 0.4;
        const softness = 0.3;
        let alpha = (value - threshold) / softness;
        alpha = Math.max(0, Math.min(1, alpha)); // Clamp to [0,1]
        alpha = alpha * alpha * (3 - 2 * alpha); // Smooth curve

        const i = (y * canvas.width + x) * 4;
        const brightness = Math.floor(value * 255);
        data[i] = brightness;
        data[i + 1] = brightness;
        data[i + 2] = brightness;
        data[i + 3] = Math.floor(alpha * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  onMount(() => {
    // Setup scene
    scene = new THREE.Scene();

    // Setup camera
    camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 3); // Center camera
    camera.lookAt(0, 0, 0); // Look at the planet center

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);

    // Create exoplanet
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Load exoplanet texture
    const textureLoader = new THREE.TextureLoader();
    const planetTexture = textureLoader.load(
      '/textures/venus4_rgb_cyl_www.jpg', // Place your texture in public/textures/planet-texture.jpg
      undefined,
      undefined,
      // Fallback to procedural texture on error
      (error) => {
        console.warn('Failed to load texture, using fallback color', error);
      }
    );

    // Create material with texture
    const material = new THREE.MeshPhongMaterial({
      map: planetTexture,
      bumpMap: planetTexture,
      bumpScale: 0.05,
      specular: 0x333333,
      shininess: 0.5,
      emissive: 0x220800, // No emissive glow
    });

    planet = new THREE.Mesh(geometry, material);
    scene.add(planet);

    const glowGeometry = new THREE.SphereGeometry(1.03, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFF6B35, 
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    const cloudConfigs = [
    { radius: 1.01, opacity: 0.8, speed: 0.03 },
    { radius: 1.015, opacity: 0.4, speed: -0.02 },
    { radius: 1.02, opacity: 0.35, speed: 0.02 }
    ];

    cloudConfigs.forEach((config, index) => {
      const cloudGeometry = new THREE.SphereGeometry(config.radius, 64, 64);
      const cloudTexture = createCloudTexture();
      const cloudMaterial = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
        color: 0xFFFFFF,
        emissive: 0x554422,
        specular: 0xFFAA66,
        shininess: 10,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending
      });

      const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
      clouds.rotation.y = Math.random() * Math.PI * 2; // Random initial rotation
      clouds.userData = {
        speed: config.speed,
        geometry: cloudGeometry,
        material: cloudMaterial
      };
      cloudLayers.push(clouds);
      scene.add(clouds);
    });

    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.8
    });

    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = (Math.random() - 0.5) * 50;
      const z = (Math.random() - 0.5) * 50;
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const ambientLight = new THREE.AmbientLight(0x606060, 2.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    function animate() {
      requestAnimationFrame(animate);

      if (!isDragging) {
        planet.rotation.y += 0.002;
        glow.rotation.y += 0.002;

        cloudLayers.forEach(cloud => {
          cloud.rotation.y += cloud.userData.speed;
        });
      }

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.map?.dispose();
      material.bumpMap?.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();

      starsGeometry.dispose();
      starsMaterial.dispose();

      cloudLayers.forEach(cloud => {
        cloud.userData.geometry.dispose();
        cloud.userData.material.map?.dispose();
        cloud.userData.material.dispose();
      });

      renderer.dispose();
    };
  });

  function handleMouseDown(e) {
    isDragging = true;
    previousMousePosition = {
      x: e.clientX,
      y: e.clientY
    };
  }

  function handleMouseMove(e) {
    if (!isDragging || !planet) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    planet.rotation.y += deltaX * 0.005;
    planet.rotation.x += deltaY * 0.005;

    cloudLayers.forEach(cloud => {
      cloud.rotation.y += deltaX * 0.005;
      cloud.rotation.x += deltaY * 0.005;
    });

    previousMousePosition = {
      x: e.clientX,
      y: e.clientY
    };
  }

  function handleMouseUp() {
    isDragging = false;
  }
</script>

<div
  class="exoplanet-container"
  bind:this={container}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  role="img"
  aria-label="Interactive 3D exoplanet"
  tabindex="0"
></div>

<style>
  .exoplanet-container {
    width: 100%;
    height: 100vh;
    cursor: grab;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #000000 100%);
  }

  .exoplanet-container:active {
    cursor: grabbing;
  }
</style>
