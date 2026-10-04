/**
 * 3D Flame Lab Simulation (Three.js CDN)
 * Live GLSL flame physics, floating/falling smoke & O2 particles, CO2 spray extinguisher,
 * ceiling smoke alarm, and hidden cool flames with infrared heat vision.
 */

function initFlameLab3D(containerEl, initialOptions = {}) {
  let width = containerEl.clientWidth || 800;
  let height = containerEl.clientHeight || 500;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0.6, 1.9, 7.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  containerEl.appendChild(renderer.domElement);

  let controls = null;
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 14;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.62;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(5, 8, 4);
  scene.add(dirLight);

  const flameLight = new THREE.PointLight(0xffaa33, 0, 8, 2);
  flameLight.position.set(0, 0.8, 0);
  scene.add(flameLight);

  // Habitat room shell
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  // Floor grid
  const gridHelper = new THREE.GridHelper(10, 20, 0x3fd4ff, 0x172036);
  gridHelper.position.y = 0;
  roomGroup.add(gridHelper);

  // Ceiling detector
  const detectorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24);
  const detectorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4 });
  const detector = new THREE.Mesh(detectorGeo, detectorMat);
  detector.position.set(0, 3.2, 0);
  roomGroup.add(detector);

  const alarmLedGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const alarmLedMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const alarmLed = new THREE.Mesh(alarmLedGeo, alarmLedMat);
  alarmLed.position.set(0, 3.14, 0);
  roomGroup.add(alarmLed);

  // Burn bench / test stand
  const benchGeo = new THREE.BoxGeometry(1.8, 0.1, 1.2);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x1e2944, metalness: 0.5, roughness: 0.4 });
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.position.set(0, 0.5, 0);
  roomGroup.add(bench);

  // Fuel sample
  const fuelGeo = new THREE.BoxGeometry(0.4, 0.15, 0.4);
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0xefe3c4, roughness: 0.8 });
  const fuelMesh = new THREE.Mesh(fuelGeo, fuelMat);
  fuelMesh.position.set(0, 0.62, 0);
  roomGroup.add(fuelMesh);

  // Red CO2 Extinguisher
  const extGroup = new THREE.Group();
  extGroup.position.set(1.5, 0, 0.5);
  roomGroup.add(extGroup);
  const tankGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.8, 16);
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.3 });
  const tank = new THREE.Mesh(tankGeo, tankMat);
  tank.position.y = 0.4;
  extGroup.add(tank);
  const nozzleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle.rotation.z = Math.PI / 4;
  nozzle.position.set(-0.1, 0.85, 0);
  extGroup.add(nozzle);

  // Custom GLSL Flame Shader
  const flameVertShader = `
    uniform float uTime;
    uniform float uStretch;
    uniform float uTaper;
    uniform float uFlicker;
    varying vec3 vN;
    varying vec3 vView;
    varying float vY;

    void main() {
      vec3 p = position;
      float y01 = (p.y + 1.0) * 0.5;
      p.xz *= mix(1.0, 1.0 - y01 * y01 * 0.85, uTaper);
      float n = sin(p.y * 4.0 + uTime * 9.0) * 0.5 + sin(p.x * 5.0 - uTime * 7.0) * 0.5;
      p += normal * n * 0.06 * uFlicker;
      p.x += sin(uTime * 6.0 + p.y * 3.0) * 0.06 * uTaper * y01;
      p.y = p.y * uStretch + (uStretch - 1.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      vY = y01;
      gl_Position = projectionMatrix * mv;
    }
  `;

  const flameFragShader = `
    uniform vec3 uColor;
    uniform vec3 uTipColor;
    uniform float uIntensity;
    uniform float uOpacity;
    varying vec3 vN;
    varying vec3 vView;
    varying float vY;

    void main() {
      float facing = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
      float a = pow(facing, 1.6) * uOpacity * uIntensity;
      vec3 col = mix(uColor, uTipColor, smoothstep(0.25, 1.0, vY));
      gl_FragColor = vec4(col * (1.0 + facing * 1.4), a);
    }
  `;

  const flameMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStretch: { value: 1 },
      uTaper: { value: 0 },
      uFlicker: { value: 1 },
      uIntensity: { value: 0 },
      uOpacity: { value: 0.8 },
      uColor: { value: new THREE.Color('#ff7a18') },
      uTipColor: { value: new THREE.Color('#ffcf40') }
    },
    vertexShader: flameVertShader,
    fragmentShader: flameFragShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStretch: { value: 1 },
      uTaper: { value: 0 },
      uFlicker: { value: 1 },
      uIntensity: { value: 0 },
      uOpacity: { value: 0.95 },
      uColor: { value: new THREE.Color('#ffe28a') },
      uTipColor: { value: new THREE.Color('#ffffff') }
    },
    vertexShader: flameVertShader,
    fragmentShader: flameFragShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0.72, 0);
  scene.add(flameGroup);

  const flameMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 40), flameMat);
  flameGroup.add(flameMesh);
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 32), coreMat);
  flameGroup.add(coreMesh);

  // Cool flame mesh (invisible without heat vision)
  const coolMat = new THREE.MeshBasicMaterial({
    color: 0x4fe0ff,
    wireframe: true,
    transparent: true,
    opacity: 0
  });
  const coolMesh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 24), coolMat);
  flameGroup.add(coolMesh);

  // Particles: Oxygen (blue pairs) & Smoke (grey) & Spray (white)
  const O2_COUNT = 150;
  const o2Geo = new THREE.BufferGeometry();
  const o2Pos = new Float32Array(O2_COUNT * 3);
  for (let i = 0; i < O2_COUNT; i++) {
    o2Pos[i * 3] = (Math.random() - 0.5) * 4;
    o2Pos[i * 3 + 1] = Math.random() * 3;
    o2Pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  o2Geo.setAttribute('position', new THREE.BufferAttribute(o2Pos, 3));
  const o2Mat = new THREE.PointsMaterial({ color: 0x3fd4ff, size: 0.08, transparent: true, opacity: 0.7 });
  const o2Points = new THREE.Points(o2Geo, o2Mat);
  scene.add(o2Points);

  const SMOKE_COUNT = 120;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(SMOKE_COUNT * 3);
  for (let i = 0; i < SMOKE_COUNT; i++) {
    smokePos[i * 3] = 0;
    smokePos[i * 3 + 1] = -10;
    smokePos[i * 3 + 2] = 0;
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokeMat = new THREE.PointsMaterial({ color: 0x777788, size: 0.22, transparent: true, opacity: 0.4 });
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  scene.add(smokePoints);

  const smokeData = Array.from({ length: SMOKE_COUNT }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0
  }));

  // State object
  const state = {
    burning: false,
    coolFlame: false,
    heatVision: false,
    spraying: false,
    alarm: false,
    gravity: initialOptions.gravity ?? 0.16,
    o2: initialOptions.o2 ?? 34,
    material: initialOptions.material || { loi: 18, flam: 1, color: '#efe3c4' },
    fuelLeft: 100,
    targetIntensity: 0,
    currentIntensity: 0
  };

  function updateFlameProperties() {
    const sg = Math.sqrt(Math.max(0, state.gravity));
    const canBurn = state.o2 >= state.material.loi;
    const oxy = Math.min(1.4, Math.max(0.3, (state.o2 - state.material.loi) / 14 + 0.35));
    const size = canBurn && state.burning ? state.material.flam * oxy * (0.62 + 0.4 * sg) : 0;
    const blueness = 1 - Math.min(1, sg * 1.15);

    state.targetIntensity = size > 0 ? 1 : 0;

    const stretch = 1 + 1.3 * sg;
    const taper = Math.min(1, sg * 1.4);

    [flameMat, coreMat].forEach((m) => {
      m.uniforms.uStretch.value = stretch;
      m.uniforms.uTaper.value = taper;
    });

    if (blueness > 0.6) {
      flameMat.uniforms.uColor.value.set('#1e40af');
      flameMat.uniforms.uTipColor.value.set('#3b82f6');
      coreMat.uniforms.uColor.value.set('#60a5fa');
      flameLight.color.set('#3b82f6');
    } else {
      flameMat.uniforms.uColor.value.set('#ff6a2b');
      flameMat.uniforms.uTipColor.value.set('#ffd23f');
      coreMat.uniforms.uColor.value.set('#fff3b0');
      flameLight.color.set('#ff9a3d');
    }

    flameMesh.scale.setScalar(0.7 + size * 0.7);
    coreMesh.scale.setScalar(0.4 + size * 0.4);

    // Cool flame visibility
    coolMesh.visible = state.coolFlame;
    coolMat.opacity = state.coolFlame && state.heatVision ? 0.75 : 0;
  }

  // Animation Loop
  let reqId = null;
  let lastTime = performance.now();

  function animate(now) {
    reqId = requestAnimationFrame(animate);
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    const t = now / 1000;

    if (controls) controls.update();

    // Smooth intensity transitions
    state.currentIntensity += (state.targetIntensity - state.currentIntensity) * 0.1;
    flameMat.uniforms.uIntensity.value = state.currentIntensity;
    coreMat.uniforms.uIntensity.value = state.currentIntensity;
    flameLight.intensity = state.currentIntensity * 3.5;
    flameMat.uniforms.uTime.value = t;
    coreMat.uniforms.uTime.value = t;

    // Fuel burning consumption
    if (state.burning && state.fuelLeft > 0) {
      state.fuelLeft = Math.max(0, state.fuelLeft - dt * 1.8);
      fuelMesh.scale.y = Math.max(0.1, state.fuelLeft / 100);
      fuelMesh.position.y = 0.5 + (0.15 * fuelMesh.scale.y) / 2;
      fuelMat.color.setHex(state.fuelLeft < 30 ? 0x22110c : 0x7c4f34);
      if (state.fuelLeft <= 0) {
        state.burning = false;
        state.targetIntensity = 0;
      }
    }

    // Extinguisher spray effect
    if (state.spraying) {
      state.burning = false;
      state.targetIntensity = 0;
    }

    // Oxygen particle drift
    const posArr = o2Geo.attributes.position.array;
    for (let i = 0; i < O2_COUNT; i++) {
      const idx = i * 3;
      if (state.burning) {
        // Pulled toward flame
        posArr[idx] += (0 - posArr[idx]) * 0.015;
        posArr[idx + 1] += (0.8 - posArr[idx + 1]) * 0.015;
        posArr[idx + 2] += (0 - posArr[idx + 2]) * 0.015;
        if (Math.abs(posArr[idx]) < 0.2 && Math.abs(posArr[idx + 1] - 0.8) < 0.2) {
          posArr[idx] = (Math.random() - 0.5) * 4;
          posArr[idx + 1] = Math.random() * 3;
          posArr[idx + 2] = (Math.random() - 0.5) * 4;
        }
      } else {
        posArr[idx + 1] += Math.sin(t + i) * 0.001;
      }
    }
    o2Geo.attributes.position.needsUpdate = true;

    // Smoke particle simulation
    const sArr = smokeGeo.attributes.position.array;
    let alarmTriggered = false;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const s = smokeData[i];
      if (state.burning && !s.active && Math.random() < 0.12) {
        s.active = true;
        s.x = (Math.random() - 0.5) * 0.1;
        s.y = 0.9;
        s.z = (Math.random() - 0.5) * 0.1;
        s.vx = (Math.random() - 0.5) * 0.02;
        s.vy = 0.01 + state.gravity * 0.04;
        s.vz = (Math.random() - 0.5) * 0.02;
        s.life = 1;
      }

      if (s.active) {
        s.x += s.vx;
        s.y += s.vy;
        s.z += s.vz;
        s.life -= dt * 0.25;

        // Check if ceiling alarm reached
        if (s.y >= 3.0 && Math.hypot(s.x, s.z) < 0.8) {
          alarmTriggered = true;
        }

        if (s.life <= 0 || s.y > 3.4) {
          s.active = false;
          s.y = -10;
        }
      }
      sArr[i * 3] = s.x;
      sArr[i * 3 + 1] = s.y;
      sArr[i * 3 + 2] = s.z;
    }
    smokeGeo.attributes.position.needsUpdate = true;

    // Alarm light
    if (alarmTriggered && !state.alarm) {
      state.alarm = true;
      alarmLedMat.color.setHex(0xf43f5e);
      window.dispatchEvent(new CustomEvent('lab-alarm', { detail: true }));
    }

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

  // Return Controller API
  return {
    ignite() {
      state.burning = true;
      state.spraying = false;
      state.coolFlame = false;
      updateFlameProperties();
    },
    extinguish() {
      state.spraying = true;
      setTimeout(() => {
        state.spraying = false;
        state.burning = false;
        state.targetIntensity = 0;
        // In 0g or low g with fuel droplet, create cool flame!
        if (state.gravity < 0.2) {
          state.coolFlame = true;
        }
        updateFlameProperties();
      }, 900);
    },
    resetFuel() {
      state.fuelLeft = 100;
      state.burning = false;
      state.coolFlame = false;
      state.alarm = false;
      alarmLedMat.color.setHex(0x34d399);
      fuelMesh.scale.y = 1;
      fuelMesh.position.y = 0.5 + 0.075;
      fuelMat.color.setHex(0xefe3c4);
      updateFlameProperties();
    },
    setHeatVision(active) {
      state.heatVision = active;
      updateFlameProperties();
    },
    updateEnvironment(opts = {}) {
      if (opts.gravity !== undefined) state.gravity = opts.gravity;
      if (opts.o2 !== undefined) state.o2 = opts.o2;
      if (opts.material !== undefined) {
        state.material = opts.material;
        fuelMat.color.setStyle(state.material.color || '#efe3c4');
      }
      updateFlameProperties();
    },
    getState() {
      return { ...state };
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
  window.initFlameLab3D = initFlameLab3D;
}
