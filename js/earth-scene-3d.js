/**
 * 3D Solar Storm vs Earth Simulation (Three.js CDN)
 * Realistic Earth with procedural lighting, squashed magnetopause boundary (Shue model),
 * dynamic auroral oval curtains that shift toward equator with Kp, and satellite threat indicators.
 */

function initEarthScene3D(containerEl) {
  let width = containerEl.clientWidth || 800;
  let height = containerEl.clientHeight || 500;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
  camera.position.set(0, 3, 11);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  containerEl.appendChild(renderer.domElement);

  let controls = null;
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 4;
    controls.maxDistance = 25;
  }

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const STAR_COUNT = 1200;
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 80;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, opacity: 0.5, transparent: true });
  scene.add(new THREE.Points(starGeo, starMat));

  // Solar Light from +X (sun direction)
  const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
  sunLight.position.set(12, 1, 2);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x1e293b, 0.4);
  scene.add(ambientLight);

  // Earth Group
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // Earth Globe
  const earthGeo = new THREE.SphereGeometry(1.5, 48, 48);
  const earthMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.7,
    metalness: 0.1
  });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthGroup.add(earthMesh);

  // Atmosphere Glow
  const atmosGeo = new THREE.SphereGeometry(1.58, 36, 36);
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide
  });
  earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

  // Auroral Oval Curtains (North and South)
  const auroraGeo = new THREE.TorusGeometry(0.7, 0.08, 16, 48);
  const auroraMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.4,
    wireframe: true
  });
  const northAurora = new THREE.Mesh(auroraGeo, auroraMat);
  northAurora.rotation.x = Math.PI / 2;
  northAurora.position.y = 1.35;
  earthGroup.add(northAurora);

  const southAurora = new THREE.Mesh(auroraGeo, auroraMat.clone());
  southAurora.rotation.x = Math.PI / 2;
  southAurora.position.y = -1.35;
  earthGroup.add(southAurora);

  // Magnetopause Boundary Shell (squashed on dayside +X, tail on nightside -X)
  const magnetGeo = new THREE.BufferGeometry();
  const LINE_POINTS = 64;
  const positions = new Float32Array(LINE_POINTS * 3);
  for (let i = 0; i < LINE_POINTS; i++) {
    const theta = (i / LINE_POINTS) * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * 3.5;
    positions[i * 3 + 1] = Math.sin(theta) * 3.5;
    positions[i * 3 + 2] = 0;
  }
  magnetGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const magnetMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
  const magnetLine = new THREE.LineLoop(magnetGeo, magnetMat);
  scene.add(magnetLine);

  // Satellites
  // ISS (LEO) - close
  const issGeo = new THREE.BoxGeometry(0.12, 0.06, 0.06);
  const issMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const issMesh = new THREE.Mesh(issGeo, issMat);
  earthGroup.add(issMesh);

  // GEO Satellite - far
  const geoGeo = new THREE.BoxGeometry(0.16, 0.08, 0.08);
  const geoMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const geoMesh = new THREE.Mesh(geoGeo, geoMat);
  earthGroup.add(geoMesh);

  // Simulation parameters
  let currentImpact = {
    kp: 1,
    rmp: 10.9,
    auroraLat: 66,
    geoExposed: false,
    G: 0
  };

  function updateSimulation(impact) {
    currentImpact = impact;

    // Auroral oval size: moves toward equator as Kp rises
    // Lat 66° = ring radius ~0.65; Lat 35° = ring radius ~1.2
    const radius = Math.min(1.4, Math.max(0.5, 0.6 + (impact.kp / 9) * 0.75));
    northAurora.scale.set(radius, radius, 1);
    northAurora.position.y = Math.sqrt(Math.max(0.01, 1.5 * 1.5 - radius * radius * 0.8));
    southAurora.scale.set(radius, radius, 1);
    southAurora.position.y = -northAurora.position.y;

    // Aurora brightness & color: green -> red for severe storms
    if (impact.kp >= 7) {
      auroraMat.color.setHex(0xf43f5e);
      auroraMat.opacity = 0.8;
    } else if (impact.kp >= 4) {
      auroraMat.color.setHex(0xfacc15);
      auroraMat.opacity = 0.6;
    } else {
      auroraMat.color.setHex(0x34d399);
      auroraMat.opacity = 0.35;
    }

    // Magnetopause stand-off line: Shue distance (in Earth radii)
    // Scaled to 3D scene (1 Earth radius = 1.5 units)
    const standOff = (Math.max(4, impact.rmp) / 10.9) * 4.5;
    const pos = magnetGeo.attributes.position.array;
    for (let i = 0; i < LINE_POINTS; i++) {
      const angle = (i / LINE_POINTS) * Math.PI * 2;
      // Day side (+X) is squashed; night side (-X) stretches into tail
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const r = cosA > 0 ? standOff * (1 - 0.25 * cosA) : standOff * (1 - 1.2 * cosA);
      pos[i * 3] = r * cosA;
      pos[i * 3 + 1] = r * sinA * 0.9;
      pos[i * 3 + 2] = 0;
    }
    magnetGeo.attributes.position.needsUpdate = true;

    // GEO Satellite danger check
    if (impact.geoExposed) {
      geoMat.color.setHex(0xf43f5e);
    } else {
      geoMat.color.setHex(0x34d399);
    }

    // ISS threat check
    if (impact.kp >= 8) {
      issMat.color.setHex(0xf43f5e);
    } else if (impact.kp >= 5) {
      issMat.color.setHex(0xfacc15);
    } else {
      issMat.color.setHex(0x34d399);
    }
  }

  // Animation Loop
  let reqId = null;
  function animate() {
    reqId = requestAnimationFrame(animate);
    const t = performance.now() / 1000;

    if (controls) controls.update();

    earthMesh.rotation.y += 0.003;

    // Satellites orbiting
    const issAngle = t * 1.5;
    issMesh.position.set(Math.cos(issAngle) * 1.8, Math.sin(issAngle * 0.7) * 0.4, Math.sin(issAngle) * 1.8);

    const geoAngle = t * 0.3;
    geoMesh.position.set(Math.cos(geoAngle) * 4.2, 0, Math.sin(geoAngle) * 4.2);

    renderer.render(scene, camera);
  }
  reqId = requestAnimationFrame(animate);

  function resize() {
    width = containerEl.clientWidth || 800;
    height = containerEl.clientHeight || 500;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);

  return {
    update(impact) {
      updateSimulation(impact);
    },
    destroy() {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      containerEl.innerHTML = '';
    }
  };
}

if (typeof window !== 'undefined') {
  window.initEarthScene3D = initEarthScene3D;
}
