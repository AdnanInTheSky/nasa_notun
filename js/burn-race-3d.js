/**
 * 3D Burn Race Simulation (Three.js CDN)
 * Two test-bench lanes (A & B). Fuel strips char progressively,
 * dynamic flames ride the burn fronts.
 */

function initBurnRace3D(containerEl) {
  let width = containerEl.clientWidth || 700;
  let height = containerEl.clientHeight || 350;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 3.5, 5.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  containerEl.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 6, 4);
  scene.add(dirLight);

  // Bench table
  const benchGeo = new THREE.BoxGeometry(5.2, 0.1, 2.2);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x172036, roughness: 0.5 });
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.position.y = -0.05;
  scene.add(bench);

  // Lanes A & B
  const LEN = 4.0;
  const START_X = -LEN / 2;

  function createLaneMesh(z, colorHex) {
    const group = new THREE.Group();
    group.position.set(0, 0.05, z);
    scene.add(group);

    // Fresh strip
    const freshGeo = new THREE.BoxGeometry(LEN, 0.04, 0.5);
    const freshMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
    const freshMesh = new THREE.Mesh(freshGeo, freshMat);
    group.add(freshMesh);

    // Char strip
    const charGeo = new THREE.BoxGeometry(LEN, 0.03, 0.5);
    const charMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.9 });
    const charMesh = new THREE.Mesh(charGeo, charMat);
    charMesh.scale.x = 0.001;
    group.add(charMesh);

    // Flame group riding the front
    const flameGrp = new THREE.Group();
    flameGrp.position.set(START_X, 0.15, 0);
    group.add(flameGrp);

    const fGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const fMat = new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.9 });
    const fMesh = new THREE.Mesh(fGeo, fMat);
    flameGrp.add(fMesh);

    const cGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const cMat = new THREE.MeshBasicMaterial({ color: 0xffef8a });
    const cMesh = new THREE.Mesh(cGeo, cMat);
    flameGrp.add(cMesh);

    const fLight = new THREE.PointLight(0xff9922, 0, 3, 2);
    flameGrp.add(fLight);

    return {
      group,
      freshMesh,
      charMesh,
      flameGrp,
      fMesh,
      fLight,
      setProgress(p, burning) {
        p = Math.max(0, Math.min(1, p));
        const front = START_X + p * LEN;

        freshMesh.scale.x = Math.max(0.001, 1 - p);
        freshMesh.position.x = front + ((1 - p) * LEN) / 2;

        charMesh.scale.x = Math.max(0.001, p);
        charMesh.position.x = START_X + (p * LEN) / 2;

        flameGrp.position.x = front;
        flameGrp.visible = burning && p < 1;
        fLight.intensity = burning ? 2 : 0;
      }
    };
  }

  const laneA = createLaneMesh(-0.55, 0xffd27a);
  const laneB = createLaneMesh(0.55, 0x8fc8ff);

  // Render loop
  let reqId = null;
  function animate() {
    reqId = requestAnimationFrame(animate);
    const t = performance.now() / 1000;
    laneA.flameGrp.scale.set(1 + Math.sin(t * 15) * 0.15, 1 + Math.cos(t * 18) * 0.2, 1);
    laneB.flameGrp.scale.set(1 + Math.cos(t * 15) * 0.15, 1 + Math.sin(t * 18) * 0.2, 1);
    renderer.render(scene, camera);
  }
  reqId = requestAnimationFrame(animate);

  function resize() {
    width = containerEl.clientWidth || 700;
    height = containerEl.clientHeight || 350;
    camera.aspect = width / height;
    camera.updateProjectionMatrix;
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);

  return {
    update(progA, burningA, progB, burningB) {
      laneA.setProgress(progA, burningA);
      laneB.setProgress(progB, burningB);
    },
    reset() {
      laneA.setProgress(0, false);
      laneB.setProgress(0, false);
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
  window.initBurnRace3D = initBurnRace3D;
}
