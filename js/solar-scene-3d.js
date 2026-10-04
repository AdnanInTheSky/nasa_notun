/**
 * 3D Solar Flare & Space Weather Simulation Visualizer (Three.js CDN)
 * Features:
 * - Glowing animated Sun with pulsating corona and dynamic magnetic prominence loops
 * - Continuous heliospheric solar wind particle field
 * - 4-stage flare eruption sequence:
 *   1. Active region flash & magnetic loop reconnection (T+0)
 *   2. Speed-of-light X-ray radiation wave front (T+8 min)
 *   3. Relativistic Solar Energetic Protons (SEP) streaming along the golden Parker Spiral (T+20 min)
 *   4. Expanding Coronal Mass Ejection (CME) shockwave impacting Earth & Mars (T+1-3 days)
 * - Dynamic Earth magnetosphere shield (compresses on dayside, turns crimson/violet during geomagnetic storms)
 * - Camera focus presets: Full Solar System, Close-up Sun, Earth Shield, Mars Habitat
 */

(function (window) {
  'use strict';

  function initSolarScene3D(containerEl) {
    if (!containerEl) return null;
    let width = containerEl.clientWidth || 800;
    let height = containerEl.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#02030a');
    scene.fog = new THREE.FogExp2('#02030a', 0.005);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    camera.position.set(1.5, 4.0, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(renderer.domElement);

    let controls = null;
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.target.set(0.5, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 4;
      controls.maxDistance = 50;
    }

    // Ambient Starfield
    const starGeo = new THREE.BufferGeometry();
    const STAR_COUNT = 1800;
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 160;
      starPos[i + 1] = (Math.random() - 0.5) * 120;
      starPos[i + 2] = (Math.random() - 0.5) * 160;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.75 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Planetary Orbit Path Guides (Dashed Rings)
    function createOrbitRing(radius, color = 0x334155) {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x - 6.5, 0, p.y)));
      const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.35 });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      return line;
    }
    scene.add(createOrbitRing(11, 0x38bdf8)); // Earth orbit distance
    scene.add(createOrbitRing(16, 0xf87171)); // Mars orbit distance

    // -------------------------------------------------------------
    // The Sun System (Position: X = -6.5)
    // -------------------------------------------------------------
    const sunGroup = new THREE.Group();
    sunGroup.position.set(-6.5, 0, 0);
    scene.add(sunGroup);

    // Glowing Photosphere
    const sunGeo = new THREE.SphereGeometry(2.6, 40, 40);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa11 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunMesh);

    // Multi-layer Corona Atmosphere Glow
    const coronaGeo = new THREE.SphereGeometry(3.1, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunGroup.add(coronaMesh);

    const outerGlowGeo = new THREE.SphereGeometry(3.8, 32, 32);
    const outerGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    sunGroup.add(outerGlow);

    // Sun Point Light
    const sunLight = new THREE.PointLight(0xfff5cc, 2.5, 60, 1.2);
    sunGroup.add(sunLight);

    // Active Region Sunspot & Magnetic Prominence Arch
    const sunspotGroup = new THREE.Group();
    sunspotGroup.position.set(2.45, 0.4, 0.6);
    sunGroup.add(sunspotGroup);

    const sunspotDarkGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const sunspotDarkMat = new THREE.MeshBasicMaterial({ color: 0x331100 });
    const sunspotDark = new THREE.Mesh(sunspotDarkGeo, sunspotDarkMat);
    sunspotGroup.add(sunspotDark);

    // Magnetic Loop Arc (Torus segment)
    const loopGeo = new THREE.TorusGeometry(0.45, 0.06, 12, 24, Math.PI);
    const loopMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    const magneticLoop = new THREE.Mesh(loopGeo, loopMat);
    magneticLoop.rotation.z = Math.PI / 4;
    magneticLoop.position.set(0, 0.15, 0);
    sunspotGroup.add(magneticLoop);

    // Active Region Flare Flash
    const flashGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    sunspotGroup.add(flashMesh);

    // -------------------------------------------------------------
    // Earth System (Position: X = +4.5)
    // -------------------------------------------------------------
    const earthGroup = new THREE.Group();
    earthGroup.position.set(4.5, 0, 0);
    scene.add(earthGroup);

    const earthGeo = new THREE.SphereGeometry(0.75, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5, metalness: 0.1 });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Dynamic Magnetosphere Bow Shock Shield
    const shieldGeo = new THREE.SphereGeometry(1.4, 24, 24);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x3fd4ff,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.scale.set(0.85, 1.25, 1.25); // Squashed dayside profile
    earthGroup.add(shieldMesh);

    // Moon & Lunar Gateway Orbit
    const moonGroup = new THREE.Group();
    moonGroup.position.set(2.4, 0.3, 0);
    earthGroup.add(moonGroup);

    const moonGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.9 });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    // ISS Orbit Path
    const issOrbitGeo = new THREE.RingGeometry(0.95, 0.98, 32);
    const issOrbitMat = new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const issOrbit = new THREE.Mesh(issOrbitGeo, issOrbitMat);
    issOrbit.rotation.x = Math.PI / 3;
    earthGroup.add(issOrbit);

    // -------------------------------------------------------------
    // Mars System (Position: X = +9.8)
    // -------------------------------------------------------------
    const marsGroup = new THREE.Group();
    marsGroup.position.set(9.8, -0.6, -1.5);
    scene.add(marsGroup);

    const marsGeo = new THREE.SphereGeometry(0.48, 28, 28);
    const marsMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.8 });
    const marsMesh = new THREE.Mesh(marsGeo, marsMat);
    marsGroup.add(marsMesh);

    const marsAtmosGeo = new THREE.SphereGeometry(0.55, 20, 20);
    const marsAtmosMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.2, side: THREE.BackSide });
    marsGroup.add(new THREE.Mesh(marsAtmosGeo, marsAtmosMat));

    // -------------------------------------------------------------
    // Continuous Heliospheric Solar Wind Stream
    // -------------------------------------------------------------
    const WIND_COUNT = 140;
    const windGeo = new THREE.BufferGeometry();
    const windPos = new Float32Array(WIND_COUNT * 3);
    for (let i = 0; i < WIND_COUNT * 3; i += 3) {
      windPos[i] = -6.5 + Math.random() * 22;
      windPos[i + 1] = (Math.random() - 0.5) * 3.5;
      windPos[i + 2] = (Math.random() - 0.5) * 3.5;
    }
    windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
    const windMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.16,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const windPoints = new THREE.Points(windGeo, windMat);
    scene.add(windPoints);

    // -------------------------------------------------------------
    // 4-Phase Solar Storm Eruption Wave FX
    // -------------------------------------------------------------
    // 1. Speed-of-Light X-Ray Pulse Wave
    const xrayGeo = new THREE.RingGeometry(0.2, 0.6, 36);
    const xrayMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const xrayRing = new THREE.Mesh(xrayGeo, xrayMat);
    xrayRing.rotation.y = Math.PI / 2;
    scene.add(xrayRing);

    // 2. Parker Spiral Solar Energetic Proton (SEP) Storm
    const SEP_COUNT = 150;
    const sepGeo = new THREE.BufferGeometry();
    const sepPos = new Float32Array(SEP_COUNT * 3);
    for (let i = 0; i < SEP_COUNT * 3; i++) sepPos[i] = -100;
    sepGeo.setAttribute('position', new THREE.BufferAttribute(sepPos, 3));
    const sepMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.22,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const sepPoints = new THREE.Points(sepGeo, sepMat);
    scene.add(sepPoints);

    // 3. Coronal Mass Ejection (CME) Shock Bubble
    const cmeGeo = new THREE.SphereGeometry(1.2, 32, 24);
    const cmeMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    const cmeMesh = new THREE.Mesh(cmeGeo, cmeMat);
    scene.add(cmeMesh);

    // Simulation State
    let isReplaying = false;
    let replayProgress = 0;
    let replayDuration = 7.5; // seconds
    let activeCallbacks = null;
    let currentFlareData = null;
    let stepTracker = { flash: false, xray: false, sep: false, cme: false, impact: false };

    function triggerEruption(flare, callbacks = {}) {
      currentFlareData = flare;
      activeCallbacks = callbacks;
      replayProgress = 0;
      isReplaying = true;
      stepTracker = { flash: false, xray: false, sep: false, cme: false, impact: false };

      // Update position of active region to match flare latitude/longitude
      if (flare && (flare.lat !== undefined || flare.lon !== undefined)) {
        const phi = ((90 - (flare.lat || 0)) * Math.PI) / 180;
        const theta = (((flare.lon || 0) + 90) * Math.PI) / 180;
        const r = 2.65;
        sunspotGroup.position.set(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        );
      }
    }

    // Camera Focus Presets
    function focusView(targetName) {
      if (typeof gsap === 'undefined') return;

      if (targetName === 'sun') {
        gsap.to(camera.position, { x: -3.5, y: 1.5, z: 7.5, duration: 1.2, ease: 'power2.inOut' });
        if (controls) gsap.to(controls.target, { x: -6.5, y: 0, z: 0, duration: 1.2, ease: 'power2.inOut' });
      } else if (targetName === 'earth') {
        gsap.to(camera.position, { x: 5.5, y: 1.8, z: 5.5, duration: 1.2, ease: 'power2.inOut' });
        if (controls) gsap.to(controls.target, { x: 4.5, y: 0, z: 0, duration: 1.2, ease: 'power2.inOut' });
      } else if (targetName === 'mars') {
        gsap.to(camera.position, { x: 10.5, y: 0.8, z: 4.5, duration: 1.2, ease: 'power2.inOut' });
        if (controls) gsap.to(controls.target, { x: 9.8, y: -0.6, z: -1.5, duration: 1.2, ease: 'power2.inOut' });
      } else {
        // Full Solar System Overview
        gsap.to(camera.position, { x: 1.5, y: 4.0, z: 16, duration: 1.2, ease: 'power2.inOut' });
        if (controls) gsap.to(controls.target, { x: 0.5, y: 0, z: 0, duration: 1.2, ease: 'power2.inOut' });
      }
    }

    // Master Render Loop
    let clock = new THREE.Clock();
    let animFrameId = null;

    function renderLoop() {
      animFrameId = requestAnimationFrame(renderLoop);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Continuous Solar Rotations
      sunMesh.rotation.y += 0.003;
      coronaMesh.scale.setScalar(1 + Math.sin(time * 3.5) * 0.04);
      earthMesh.rotation.y += 0.015;
      moonGroup.rotation.y += 0.008;
      marsMesh.rotation.y += 0.01;

      // Continuous Solar Wind Particle Flow
      const wArr = windGeo.attributes.position.array;
      for (let i = 0; i < WIND_COUNT * 3; i += 3) {
        wArr[i] += 4.5 * delta;
        if (wArr[i] > 16) {
          wArr[i] = -6.5;
          wArr[i + 1] = (Math.random() - 0.5) * 3.5;
          wArr[i + 2] = (Math.random() - 0.5) * 3.5;
        }
      }
      windGeo.attributes.position.needsUpdate = true;

      // Active Eruption Sequence Animation
      if (isReplaying) {
        replayProgress += delta;
        const pTotal = replayProgress / replayDuration;

        // Stage 0: Eruption Flash (T+0s to 1.2s)
        if (replayProgress < 1.4) {
          if (!stepTracker.flash) {
            stepTracker.flash = true;
            if (activeCallbacks && activeCallbacks.onEvent) activeCallbacks.onEvent('flash');
          }
          const flashPulse = Math.sin(replayProgress * 12);
          flashMat.opacity = Math.max(0, flashPulse * 0.95);
          flashMesh.scale.setScalar(1 + Math.abs(flashPulse) * 1.5);
          magneticLoop.scale.setScalar(1 + Math.abs(flashPulse) * 0.8);
          magneticLoop.material.color.setHex(0xffffff);
        } else {
          flashMat.opacity = 0;
          magneticLoop.scale.setScalar(1);
          magneticLoop.material.color.setHex(0xffcc33);
        }

        // Stage 1: Speed-of-Light X-Ray Pulse Wave (1.0s to 3.2s)
        if (replayProgress >= 1.0 && replayProgress < 3.2) {
          if (!stepTracker.xray) {
            stepTracker.xray = true;
            if (activeCallbacks && activeCallbacks.onEvent) activeCallbacks.onEvent('xray');
          }
          const p = (replayProgress - 1.0) / 2.2;
          xrayRing.position.set(-6.5 + p * 13, 0, 0);
          xrayRing.scale.set(1 + p * 8, 1 + p * 8, 1 + p * 8);
          xrayMat.opacity = Math.max(0, 0.85 * (1 - p));
        } else {
          xrayMat.opacity = 0;
        }

        // Stage 2: Parker Spiral Energetic Proton Storm (2.2s to 5.4s)
        if (replayProgress >= 2.2 && replayProgress < 5.4) {
          if (!stepTracker.sep) {
            stepTracker.sep = true;
            if (activeCallbacks && activeCallbacks.onEvent) activeCallbacks.onEvent('sep');
          }
          sepMat.opacity = 0.9;
          const p = (replayProgress - 2.2) / 3.2;
          const sArr = sepGeo.attributes.position.array;
          for (let i = 0; i < SEP_COUNT; i++) {
            const frac = (i / SEP_COUNT + p * 2.0) % 1;
            const x = -6.5 + frac * 14;
            // Arching Parker spiral curved geometry:
            const y = Math.sin(frac * Math.PI) * 2.2 + (Math.sin(i * 99) * 0.25);
            const z = Math.cos(frac * Math.PI * 0.85) * 1.8 + (Math.cos(i * 33) * 0.25);
            sArr[i * 3] = x;
            sArr[i * 3 + 1] = y;
            sArr[i * 3 + 2] = z;
          }
          sepGeo.attributes.position.needsUpdate = true;
        } else {
          sepMat.opacity = 0;
        }

        // Stage 3: CME Shockwave Expansion (4.0s to 7.2s)
        if (replayProgress >= 4.0 && replayProgress < 7.2) {
          if (!stepTracker.cme) {
            stepTracker.cme = true;
            if (activeCallbacks && activeCallbacks.onEvent) activeCallbacks.onEvent('cme');
          }
          const p = (replayProgress - 4.0) / 3.2;
          cmeMesh.position.set(-6.5 + p * 13, 0, 0);
          cmeMesh.scale.set(1 + p * 5.5, 1 + p * 4.2, 1 + p * 4.2);
          cmeMat.opacity = Math.max(0, 0.65 * (1 - p * 0.85));

          // Impact on Earth Magnetosphere (around 5.8s)
          if (replayProgress >= 5.6 && !stepTracker.impact) {
            stepTracker.impact = true;
            if (activeCallbacks && activeCallbacks.onEvent) activeCallbacks.onEvent('impact');
          }
        } else {
          cmeMat.opacity = 0;
        }

        // Dayside Magnetosphere Compression Reaction
        if (stepTracker.impact && replayProgress < 7.0) {
          shieldMesh.scale.set(0.55, 1.45, 1.45); // Severe squashed magnetopause
          shieldMat.color.setHex(0xf43f5e); // Crimson red alert glow
          shieldMat.opacity = 0.55;
        } else {
          shieldMesh.scale.set(0.85, 1.25, 1.25);
          shieldMat.color.setHex(0x3fd4ff);
          shieldMat.opacity = 0.25;
        }

        // Cycle Complete
        if (replayProgress >= replayDuration) {
          isReplaying = false;
          if (activeCallbacks && activeCallbacks.onEvent) activeCallbacks.onEvent('end');
        }
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    renderLoop();

    function handleResize() {
      if (!containerEl) return;
      width = containerEl.clientWidth;
      height = containerEl.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener('resize', handleResize);

    return {
      replay(flare, callbacks) {
        triggerEruption(flare, callbacks);
      },
      triggerEruption,
      focusView,
      destroy() {
        cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', handleResize);
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }

  window.initSolarScene3D = initSolarScene3D;
})(window);
