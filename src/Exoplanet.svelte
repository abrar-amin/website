<script>
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { createCloudMaterial } from './clouds.js';

  /** @type {HTMLDivElement} */
  let container;
  /** @type {THREE.Group | undefined} */
  let world; // group holding the planet + clouds, rotated by dragging
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  // Pull the camera back on narrow containers so the planet still fits.
  const cameraDistance = (/** @type {number} */ width) => 3 + Math.max(0, (1200 - width) / 600);

  // Where the planet sits horizontally, as a fraction of the width (0.5 = centered).
  // Wide screens put it on the left; phones keep it centered.
  const planetX = (/** @type {number} */ width) => (width > 768 ? 0.25 : 0.5);

  onMount(() => {
    const { clientWidth: width, clientHeight: height } = container;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = cameraDistance(width);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    world = group;
    scene.add(group);

    // Planet
    const planetTexture = new THREE.TextureLoader().load('/textures/venus4_rgb_cyl_www.jpg');
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: planetTexture,
        bumpMap: planetTexture,
        bumpScale: 0.05,
        specular: 0x333333,
        shininess: 0.5,
      })
    ));

    // Cloud deck: shader-driven winds and sun-heated convection (see clouds.js)
    const sunPosition = new THREE.Vector3(5, 3, 5);
    const cloudMaterial = createCloudMaterial(sunPosition);
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 96), cloudMaterial));

    // Background stars
    const starPositions = Array.from({ length: 3000 }, () => (Math.random() - 0.5) * 50);
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.8 })
    ));

    // Lights
    scene.add(new THREE.AmbientLight(0x606060, 2.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.copy(sunPosition);
    scene.add(sun);

    /** @type {number} */
    let frameId;
    const clock = new THREE.Clock();
    function animate() {
      frameId = requestAnimationFrame(animate);
      cloudMaterial.uniforms.uTime.value = clock.getElapsedTime();
      if (!isDragging) group.rotation.y += 0.002;
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const { clientWidth: w, clientHeight: h } = container;
      camera.aspect = w / h;
      camera.position.z = cameraDistance(w);
      // Shift the view sideways so the planet lands at planetX instead of the center.
      camera.setViewOffset(w, h, (0.5 - planetX(w)) * w, 0, w, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    // Follow the panel's size (not just the window's), e.g. when the layout changes.
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
      planetTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  });

  /** @param {MouseEvent} e */
  function handleMouseDown(e) {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  }

  /** @param {MouseEvent} e */
  function handleMouseMove(e) {
    if (!isDragging || !world) return;
    world.rotation.y += (e.clientX - lastMouse.x) * 0.005;
    world.rotation.x += (e.clientY - lastMouse.y) * 0.005;
    lastMouse = { x: e.clientX, y: e.clientY };
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
    height: 100%;
    cursor: grab;
    background: #000;
  }

  .exoplanet-container:active {
    cursor: grabbing;
  }
</style>
