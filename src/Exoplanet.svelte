<script>
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { createCloudMaterial } from './clouds.js';
  import { ROTATION_PERIOD_S, TIME_SCALE } from './timescale.js';

  /** @type {HTMLDivElement} */
  let container;
  /** @type {THREE.Group | undefined} */
  let world; // group holding Neptune and the Sun, rotated by dragging
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  // Neptune
  const OBLIQUITY = THREE.MathUtils.degToRad(28.32); // axial tilt relative to its orbit
  const ORBITAL_PERIOD_YEARS = 164.79;
  const SOUTHERN_SUMMER_SOLSTICE = 2005.0; // year the south pole last pointed most toward the Sun
  // Eccentricity is 0.009, which shifts the season by under 1 degree, so the orbit is treated as circular.
  const SECONDS_PER_YEAR = 365.25 * 86400;

  // Speed-up for the orbit: a real one is 164.79 years. The spin and winds keep the page's
  // one-Neptune-day-per-minute pace; the orbit runs on its own, much faster clock.
  const SCREEN_SECONDS_PER_ORBIT = 240;

  // The Sun as seen from Neptune: 30.07 AU away it spans about 1 arcminute, well under a pixel here,
  // so it is drawn as a fixed-size point of sunlight colour (a ~5800 K blackbody) rather than a disc.
  const SUN_DISTANCE = 400; // far enough to behave like a point at infinity
  const SUN_POINT_PX = 3;

  const FOV = 75;
  const ELEVATION = THREE.MathUtils.degToRad(15); // camera height above Neptune's orbital plane

  // Pull the camera back on narrow containers so the planet still fits.
  const cameraDistance = (/** @type {number} */ width) => 3 + Math.max(0, (1200 - width) / 600);

  // Where the planet sits horizontally, as a fraction of the width (0.5 = centered).
  // Wide screens put it on the left; phones keep it centered.
  const planetX = (/** @type {number} */ width) => (width > 768 ? 0.25 : 0.5);

  /**
   * Direction from Neptune to the Sun for a decimal year, in a frame centered on Neptune that does not rotate.
   * Neptune orbits prograde (counterclockwise seen from the north), so seen from Neptune the Sun
   * goes around the same way. Angle 0 is the 2005 southern summer solstice.
   * @param {number} year
   */
  function sunDirection(year) {
    const angle = (2 * Math.PI * (year - SOUTHERN_SUMMER_SOLSTICE)) / ORBITAL_PERIOD_YEARS;
    return new THREE.Vector3(-Math.cos(angle), 0, Math.sin(angle));
  }

  onMount(() => {
    const { clientWidth: width, clientHeight: height } = container;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // world (dragged by the user) > Sun, tilt (spin axis, fixed in space) > body (spins once per Neptune day)
    const group = new THREE.Group();
    world = group;
    scene.add(group);
    const tilt = new THREE.Group();
    group.add(tilt);
    const body = new THREE.Group();
    tilt.add(body);

    // The pole keeps one direction in space while the Sun appears to go around; that alone produces the seasons.
    // At the 2005 southern summer solstice the north pole leaned directly away from the Sun.
    const UP = new THREE.Vector3(0, 1, 0);
    const pole = UP.clone().multiplyScalar(Math.cos(OBLIQUITY))
      .addScaledVector(sunDirection(SOUTHERN_SUMMER_SOLSTICE), -Math.sin(OBLIQUITY));
    tilt.quaternion.setFromUnitVectors(UP, pole);

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
    const startYear = 1970 + Date.now() / 1000 / SECONDS_PER_YEAR; // start from where the Sun really is in Neptune's sky today
    const toSun = sunDirection(startYear);
    const cloudMaterial = createCloudMaterial(toSun, TIME_SCALE);
    body.add(new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 96), cloudMaterial));

    // The Sun, and the sunlight it casts (parallel rays, since it is effectively at infinity)
    const sunGeometry = new THREE.BufferGeometry();
    sunGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const sun = new THREE.Points(
      sunGeometry,
      new THREE.PointsMaterial({ color: 0xfff2e3, size: SUN_POINT_PX, sizeAttenuation: false })
    );
    group.add(sun);
    const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.add(sunlight);

    // Background stars
    const starPositions = Array.from({ length: 3000 }, () => (Math.random() - 0.5) * 50);
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.8 })
    ));

    // Faint fill so the night side isn't pitch black
    scene.add(new THREE.AmbientLight(0x606060, 1.2));

    const sunWorld = new THREE.Vector3();

    /** @type {number} */
    let frameId;
    const clock = new THREE.Clock();
    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      cloudMaterial.uniforms.uTime.value = t;
      const year = startYear + (t / SCREEN_SECONDS_PER_ORBIT) * ORBITAL_PERIOD_YEARS;
      sun.position.copy(sunDirection(year)).multiplyScalar(SUN_DISTANCE);
      body.rotation.y = ((t * TIME_SCALE) / ROTATION_PERIOD_S) * Math.PI * 2;
      // Cloud shading needs the world-space direction to the Sun, which changes over the year and as the view is dragged
      group.updateMatrixWorld();
      cloudMaterial.uniforms.uSunDir.value.copy(sun.getWorldPosition(sunWorld).normalize());
      renderer.render(scene, camera);
    }

    function handleResize() {
      const { clientWidth: w, clientHeight: h } = container;
      const d = cameraDistance(w);
      camera.position.set(0, d * Math.sin(ELEVATION), d * Math.cos(ELEVATION));
      camera.lookAt(0, 0, 0);
      camera.aspect = w / h;
      // Shift the view sideways so the planet lands at planetX instead of the center.
      camera.setViewOffset(w, h, (0.5 - planetX(w)) * w, 0, w, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    handleResize();
    animate();
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
  aria-label="Interactive 3D view of Neptune, with the Sun as it appears from Neptune"
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
