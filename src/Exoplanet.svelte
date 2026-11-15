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

  // Neptune
  const ROTATION_PERIOD_S = 16.11 * 3600; // sidereal day (16.11 h)
  const OBLIQUITY = THREE.MathUtils.degToRad(28.32); // axial tilt relative to its orbit
  const ORBITAL_PERIOD_YEARS = 164.79;
  const SOUTHERN_SUMMER_SOLSTICE = 2005.0; // year the south pole last pointed most toward the Sun
  // Eccentricity is 0.009, which shifts the season by under 1 degree, so the orbit is treated as circular.
  const SCREEN_SECONDS_PER_DAY = 60; // speed-up so one Neptune day takes a minute on screen
  const TIME_SCALE = ROTATION_PERIOD_S / SCREEN_SECONDS_PER_DAY;
  const SECONDS_PER_YEAR = 365.25 * 86400;

  /**
   * Direction of Neptune's north pole for a given date, in a frame where the Sun stays put.
   * The pole is fixed in space, so as Neptune orbits, the Sun sweeps around it once per orbit;
   * seen from the Sun-planet line, the pole appears to turn the other way.
   * @param {THREE.Vector3} toSun unit vector from the planet toward the Sun
   * @param {number} year decimal year
   */
  function northPole(toSun, year) {
    const orbitNormal = new THREE.Vector3(0, 1, 0).addScaledVector(toSun, -toSun.y).normalize();
    const sideways = new THREE.Vector3().crossVectors(orbitNormal, toSun);
    const angle = (2 * Math.PI * (year - SOUTHERN_SUMMER_SOLSTICE)) / ORBITAL_PERIOD_YEARS;
    // At the southern summer solstice the north pole leans directly away from the Sun.
    const lean = toSun.clone().multiplyScalar(Math.cos(angle)).addScaledVector(sideways, -Math.sin(angle));
    return orbitNormal.multiplyScalar(Math.cos(OBLIQUITY)).addScaledVector(lean, -Math.sin(OBLIQUITY));
  }

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

    // world (dragged by the user) > tilt (points the spin axis) > body (spins once per Neptune day)
    const group = new THREE.Group();
    world = group;
    scene.add(group);
    const tilt = new THREE.Group();
    group.add(tilt);
    const body = new THREE.Group();
    tilt.add(body);

    // Planet (Neptune texture: Solar System Scope, CC BY 4.0, solarsystemscope.com/textures)
    const planetTexture = new THREE.TextureLoader().load('/textures/neptune_2k.jpg');
    planetTexture.colorSpace = THREE.SRGBColorSpace;
    body.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: planetTexture,
        specular: 0x333333,
        shininess: 0.5,
      })
    ));

    // Methane clouds carried by Neptune's measured zonal winds (see clouds.js)
    const sunPosition = new THREE.Vector3(5, 3, 5);
    const toSun = sunPosition.clone().normalize();
    const UP = new THREE.Vector3(0, 1, 0);
    const startYear = 1970 + Date.now() / 1000 / SECONDS_PER_YEAR; // start from Neptune's real season today
    const cloudMaterial = createCloudMaterial(sunPosition, TIME_SCALE);
    body.add(new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 96), cloudMaterial));

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
      const t = clock.getElapsedTime();
      cloudMaterial.uniforms.uTime.value = t;
      const simSeconds = t * TIME_SCALE;
      tilt.quaternion.setFromUnitVectors(UP, northPole(toSun, startYear + simSeconds / SECONDS_PER_YEAR));
      body.rotation.y = (simSeconds / ROTATION_PERIOD_S) * Math.PI * 2;
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
