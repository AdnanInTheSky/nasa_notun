/**
 * 3D Spacecraft Three.js Visualization Engine
 * Features:
 * - Full modular spacecraft (Command Bridge, Centrifuge Ring, Science Lab, Avionics, Power Core, Propulsion)
 * - Rotating Centrifuge Ring synced to simulation RPM & wobble precession
 * - Fire particles: 0g spherical blue diffusion ball vs >0g elongated buoyant teardrop plume
 * - Fried electronics electrical sparks
 * - Vacuum venting decompression gas jets
 * - Solar Flare CME shockwave sweeping across space
 * - Earth / Mars planet globe with atmosphere glow & Moon
 * - Orbital gravitational pull vectors pointing toward celestial bodies
 * - 4 Visual Modes: Exterior Hull, X-Ray Cutaway, Thermal IR Heat-Vision, Electrical Bus Grid
 */

(function (window) {
  'use strict';

  function initSpacecraft3D(containerEl, simulation) {
    let width = containerEl.clientWidth || 900;
    let height = containerEl.clientHeight || 550;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#02040b');
    scene.fog = new THREE.FogExp2('#02040b', 0.0035);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 14, 28);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);

    // OrbitControls
    let controls = null;
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 6;
      controls.maxDistance = 120;
      controls.target.set(0, 0, -2);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xdde6ff, 0.65);
    scene.add(ambientLight);

    // Sun directional light
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    sunLight.position.set(80, 45, 120);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Secondary rim bounce light from planet
    const earthBounce = new THREE.DirectionalLight(0x4488ff, 0.8);
    earthBounce.position.set(-60, -30, -50);
    scene.add(earthBounce);

    // Master Spacecraft Group
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);

    // Celestial Group (Earth/Mars, Moon, Sun flare)
    const celestialGroup = new THREE.Group();
    scene.add(celestialGroup);

    // -------------------------------------------------------------
    // Procedural Planet & Celestial Sphere
    // -------------------------------------------------------------
    function createEarthTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // Ocean base
      ctx.fillStyle = '#081c3b';
      ctx.fillRect(0, 0, 1024, 512);

      // Continent shapes
      ctx.fillStyle = '#1e3f20';
      // Americas
      ctx.beginPath();
      ctx.arc(280, 200, 90, 0, Math.PI * 2);
      ctx.arc(330, 320, 80, 0, Math.PI * 2);
      ctx.fill();

      // Eurasia & Africa
      ctx.fillStyle = '#2d4a22';
      ctx.beginPath();
      ctx.arc(620, 180, 110, 0, Math.PI * 2);
      ctx.arc(580, 300, 95, 0, Math.PI * 2);
      ctx.arc(780, 260, 75, 0, Math.PI * 2); // Asia
      ctx.arc(840, 380, 55, 0, Math.PI * 2); // Australia
      ctx.fill();

      // Swirling white clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let i = 0; i < 40; i++) {
        const x = (i * 27) % 1024;
        const y = 80 + Math.sin(i * 0.8) * 160;
        ctx.beginPath();
        ctx.ellipse(x, y, 90, 18, Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();
      }

      return new THREE.CanvasTexture(canvas);
    }

    const planetGeo = new THREE.SphereGeometry(24, 48, 48);
    const planetMat = new THREE.MeshStandardMaterial({
      map: createEarthTexture(),
      roughness: 0.65,
      metalness: 0.1
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.position.set(-65, -45, -75);
    celestialGroup.add(planetMesh);

    // Planet atmosphere rim glow
    const atmosGeo = new THREE.SphereGeometry(25.2, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    atmosMesh.position.copy(planetMesh.position);
    celestialGroup.add(atmosMesh);

    // Moon Globe
    const moonGeo = new THREE.SphereGeometry(4.2, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, roughness: 0.9 });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(70, 35, -110);
    celestialGroup.add(moonMesh);

    // Distant Starfield Dome
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 260 + Math.random() * 40;
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // -------------------------------------------------------------
    // Gravitational Vectors (Lines from Craft to Planet & Moon)
    // -------------------------------------------------------------
    const gravityLinesGroup = new THREE.Group();
    scene.add(gravityLinesGroup);

    // Line to Earth
    const earthLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      planetMesh.position.clone().multiplyScalar(0.28)
    ]);
    const earthLineMat = new THREE.LineDashedMaterial({
      color: 0x3fd4ff,
      dashSize: 1.2,
      gapSize: 0.6,
      transparent: true,
      opacity: 0.75
    });
    const earthLine = new THREE.Line(earthLineGeo, earthLineMat);
    earthLine.computeLineDistances();
    gravityLinesGroup.add(earthLine);

    // Line to Moon
    const moonLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      moonMesh.position.clone().multiplyScalar(0.22)
    ]);
    const moonLineMat = new THREE.LineDashedMaterial({
      color: 0xa78bfa,
      dashSize: 0.8,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.6
    });
    const moonLine = new THREE.Line(moonLineGeo, moonLineMat);
    moonLine.computeLineDistances();
    gravityLinesGroup.add(moonLine);

    // -------------------------------------------------------------
    // Spacecraft Modular Architecture Construction
    // -------------------------------------------------------------
    const moduleMeshes = {};
    const moduleInteriorMeshes = {};
    const moduleThermalMeshes = {};
    const moduleElectricalConduits = {};

    // Standard materials
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.35
    });
    const darkHullMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.5
    });
    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.25
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      transmission: 0.8
    });
    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7
    });

    // 1. Central Structural Spine Truss
    const spineGeo = new THREE.CylinderGeometry(0.8, 0.8, 28, 16);
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.rotation.x = Math.PI / 2;
    spine.position.set(0, 0, -2.5);
    shipGroup.add(spine);

    // Modular section definition coordinates along Z axis:
    // SEC-A: Bridge (Z = +6.0)
    // SEC-B: Centrifuge (Z = +2.0)
    // SEC-C: Science (Z = -1.5)
    // SEC-D: Avionics (Z = -4.5)
    // SEC-E: Reactor (Z = -8.0)
    // SEC-F: Propulsion (Z = -13.0)

    // -------------------------------------------------------------
    // SEC-A: Command Bridge & Astrogation
    // -------------------------------------------------------------
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0, 7.5);
    shipGroup.add(bridgeGroup);

    const bridgeConeGeo = new THREE.ConeGeometry(1.8, 3.8, 18);
    const bridgeHull = new THREE.Mesh(bridgeConeGeo, hullMat.clone());
    bridgeHull.rotation.x = Math.PI / 2;
    bridgeGroup.add(bridgeHull);

    // Cupola observation multi-window ring
    const cupolaGeo = new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const cupola = new THREE.Mesh(cupolaGeo, glassMat);
    cupola.rotation.x = Math.PI / 2;
    cupola.position.set(0, 0, 2.0);
    bridgeGroup.add(cupola);

    // Interior cockpit consoles
    const bridgeInteriorGeo = new THREE.BoxGeometry(1.2, 0.8, 1.6);
    const bridgeInterior = new THREE.Mesh(bridgeInteriorGeo, interiorMat.clone());
    bridgeInterior.visible = false;
    bridgeGroup.add(bridgeInterior);

    moduleMeshes.bridge = bridgeHull;
    moduleInteriorMeshes.bridge = bridgeInterior;

    // -------------------------------------------------------------
    // SEC-B: Habitation Centrifuge Ring (Rotating!)
    // -------------------------------------------------------------
    const centrifugeGroup = new THREE.Group();
    centrifugeGroup.position.set(0, 0, 2.0);
    shipGroup.add(centrifugeGroup);

    // Stationary Hub Collar
    const hubCollarGeo = new THREE.CylinderGeometry(1.4, 1.4, 1.6, 24);
    const hubCollar = new THREE.Mesh(hubCollarGeo, darkHullMat);
    hubCollar.rotation.x = Math.PI / 2;
    centrifugeGroup.add(hubCollar);

    // Rotating sub-group for the ring and spokes
    const ringRotatingGroup = new THREE.Group();
    centrifugeGroup.add(ringRotatingGroup);

    // Torus Habitat Ring (Radius 14m in sim, scaled to 7.0 for visual balance)
    const ringRadius = 7.0;
    const tubeRadius = 0.9;
    const ringGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 20, 48);
    const ringHull = new THREE.Mesh(ringGeo, hullMat.clone());
    ringRotatingGroup.add(ringHull);

    // 4 Connecting Spokes / Transit Tunnels
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const spokeGeo = new THREE.CylinderGeometry(0.32, 0.32, ringRadius, 12);
      const spoke = new THREE.Mesh(spokeGeo, darkHullMat);
      spoke.rotation.z = angle;
      spoke.position.set((Math.cos(angle) * ringRadius) / 2, (Math.sin(angle) * ringRadius) / 2, 0);
      ringRotatingGroup.add(spoke);
    }

    // Interior habitat pod markers
    const ringInteriorGeo = new THREE.TorusGeometry(ringRadius, tubeRadius * 0.75, 12, 32);
    const ringInterior = new THREE.Mesh(ringInteriorGeo, interiorMat.clone());
    ringInterior.visible = false;
    ringRotatingGroup.add(ringInterior);

    moduleMeshes.centrifuge = ringHull;
    moduleInteriorMeshes.centrifuge = ringInterior;

    // -------------------------------------------------------------
    // SEC-C: Science Lab & ECLSS
    // -------------------------------------------------------------
    const scienceGroup = new THREE.Group();
    scienceGroup.position.set(0, 0, -1.8);
    shipGroup.add(scienceGroup);

    const scienceGeo = new THREE.CylinderGeometry(2.0, 2.0, 3.6, 20);
    const scienceHull = new THREE.Mesh(scienceGeo, hullMat.clone());
    scienceHull.rotation.x = Math.PI / 2;
    scienceGroup.add(scienceHull);

    // External radiator fins
    for (let i = -1; i <= 1; i += 2) {
      const finGeo = new THREE.BoxGeometry(0.08, 2.4, 2.8);
      const fin = new THREE.Mesh(finGeo, darkHullMat);
      fin.position.set(i * 2.3, 0, 0);
      scienceGroup.add(fin);
    }

    const scienceInteriorGeo = new THREE.CylinderGeometry(1.6, 1.6, 3.0, 16);
    const scienceInterior = new THREE.Mesh(scienceInteriorGeo, interiorMat.clone());
    scienceInterior.rotation.x = Math.PI / 2;
    scienceInterior.visible = false;
    scienceGroup.add(scienceInterior);

    moduleMeshes.science = scienceHull;
    moduleInteriorMeshes.science = scienceInterior;

    // -------------------------------------------------------------
    // SEC-D: Avionics Bay & DSN Comms Array
    // -------------------------------------------------------------
    const avionicsGroup = new THREE.Group();
    avionicsGroup.position.set(0, 0, -5.2);
    shipGroup.add(avionicsGroup);

    const avionicsGeo = new THREE.CylinderGeometry(1.8, 1.8, 2.6, 6); // Hexagonal pod
    const avionicsHull = new THREE.Mesh(avionicsGeo, goldFoilMat.clone());
    avionicsHull.rotation.x = Math.PI / 2;
    avionicsGroup.add(avionicsHull);

    // High-gain parabolic antenna dish
    const dishMastGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8);
    const dishMast = new THREE.Mesh(dishMastGeo, darkHullMat);
    dishMast.position.set(0, 2.2, 0);
    avionicsGroup.add(dishMast);

    const dishGeo = new THREE.SphereGeometry(1.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 3);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = -Math.PI / 3;
    dish.position.set(0, 3.4, 0.8);
    avionicsGroup.add(dish);

    // Massive Articulated Solar Array Wings
    const solarWingGroup = new THREE.Group();
    avionicsGroup.add(solarWingGroup);
    for (let side = -1; side <= 1; side += 2) {
      const mastGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8);
      const mast = new THREE.Mesh(mastGeo, darkHullMat);
      mast.rotation.z = Math.PI / 2;
      mast.position.set(side * 3.2, 0, 0);
      solarWingGroup.add(mast);

      // Solar Panel Grid (Blue photovoltaic look)
      const panelGeo = new THREE.BoxGeometry(5.5, 0.08, 2.4);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        metalness: 0.9,
        roughness: 0.2
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(side * 7.0, 0, 0);
      solarWingGroup.add(panel);
    }

    const avionicsInteriorGeo = new THREE.BoxGeometry(1.5, 1.5, 2.0);
    const avionicsInterior = new THREE.Mesh(avionicsInteriorGeo, interiorMat.clone());
    avionicsInterior.visible = false;
    avionicsGroup.add(avionicsInterior);

    moduleMeshes.avionics = avionicsHull;
    moduleInteriorMeshes.avionics = avionicsInterior;

    // -------------------------------------------------------------
    // SEC-E: Power Core & Battery Vault
    // -------------------------------------------------------------
    const reactorGroup = new THREE.Group();
    reactorGroup.position.set(0, 0, -8.8);
    shipGroup.add(reactorGroup);

    const reactorGeo = new THREE.CylinderGeometry(2.1, 2.1, 3.8, 16);
    const reactorHull = new THREE.Mesh(reactorGeo, darkHullMat.clone());
    reactorHull.rotation.x = Math.PI / 2;
    reactorGroup.add(reactorHull);

    // Glowing blue nuclear/battery containment rings
    for (let i = -1; i <= 1; i++) {
      const glowRingGeo = new THREE.TorusGeometry(2.15, 0.08, 12, 32);
      const glowRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
      glowRing.position.set(0, 0, i * 1.1);
      reactorGroup.add(glowRing);
    }

    const reactorInteriorGeo = new THREE.CylinderGeometry(1.8, 1.8, 3.2, 16);
    const reactorInterior = new THREE.Mesh(reactorInteriorGeo, interiorMat.clone());
    reactorInterior.rotation.x = Math.PI / 2;
    reactorInterior.visible = false;
    reactorGroup.add(reactorInterior);

    moduleMeshes.reactor = reactorHull;
    moduleInteriorMeshes.reactor = reactorInterior;

    // -------------------------------------------------------------
    // SEC-F: Cargo Bay & Ion Propulsion Block
    // -------------------------------------------------------------
    const propulsionGroup = new THREE.Group();
    propulsionGroup.position.set(0, 0, -13.2);
    shipGroup.add(propulsionGroup);

    const propulsionGeo = new THREE.CylinderGeometry(1.9, 2.4, 4.2, 18);
    const propulsionHull = new THREE.Mesh(propulsionGeo, hullMat.clone());
    propulsionHull.rotation.x = Math.PI / 2;
    propulsionGroup.add(propulsionHull);

    // 4 Ion Thruster Nozzles with glowing cyan plasma plumes
    const plasmaPlumes = [];
    const nozzleOffsets = [
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8]
    ];
    for (const [nx, ny] of nozzleOffsets) {
      const nozzleGeo = new THREE.CylinderGeometry(0.4, 0.55, 0.9, 16);
      const nozzle = new THREE.Mesh(nozzleGeo, darkHullMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(nx, ny, -2.4);
      propulsionGroup.add(nozzle);

      // Cyan Ion Exhaust Plume Cone
      const plumeGeo = new THREE.ConeGeometry(0.42, 2.8, 16);
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.rotation.x = -Math.PI / 2;
      plume.position.set(nx, ny, -4.0);
      propulsionGroup.add(plume);
      plasmaPlumes.push(plume);
    }

    const propInteriorGeo = new THREE.CylinderGeometry(1.6, 2.0, 3.6, 16);
    const propInterior = new THREE.Mesh(propInteriorGeo, interiorMat.clone());
    propInterior.rotation.x = Math.PI / 2;
    propInterior.visible = false;
    propulsionGroup.add(propInterior);

    moduleMeshes.propulsion = propulsionHull;
    moduleInteriorMeshes.propulsion = propInterior;

    // -------------------------------------------------------------
    // Electrical Conduit Lines (Primary 120V & Backup 28V)
    // -------------------------------------------------------------
    const primaryConduitGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1.0, 7.5),
      new THREE.Vector3(0, 1.0, 2.0),
      new THREE.Vector3(0, 1.0, -1.8),
      new THREE.Vector3(0, 1.0, -5.2),
      new THREE.Vector3(0, 1.0, -8.8),
      new THREE.Vector3(0, 1.0, -13.2)
    ]);
    const primaryConduitMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const primaryConduit = new THREE.Line(primaryConduitGeo, primaryConduitMat);
    shipGroup.add(primaryConduit);

    const backupConduitGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.0, 7.5),
      new THREE.Vector3(0, -1.0, 2.0),
      new THREE.Vector3(0, -1.0, -1.8),
      new THREE.Vector3(0, -1.0, -5.2),
      new THREE.Vector3(0, -1.0, -8.8),
      new THREE.Vector3(0, -1.0, -13.2)
    ]);
    const backupConduitMat = new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 });
    const backupConduit = new THREE.Line(backupConduitGeo, backupConduitMat);
    shipGroup.add(backupConduit);

    // -------------------------------------------------------------
    // 3D Fire & Smoke Particle Engine (0g Ball vs >0g Teardrop)
    // -------------------------------------------------------------
    const moduleFireFX = {};
    const sectionCoords = {
      bridge: new THREE.Vector3(0, 0, 7.5),
      centrifuge: new THREE.Vector3(0, 7.0, 2.0), // at top of ring
      science: new THREE.Vector3(0, 0, -1.8),
      avionics: new THREE.Vector3(0, 0, -5.2),
      reactor: new THREE.Vector3(0, 0, -8.8),
      propulsion: new THREE.Vector3(0, 0, -13.2)
    };

    for (const [key, pos] of Object.entries(sectionCoords)) {
      const fxGroup = new THREE.Group();
      fxGroup.position.copy(pos);
      shipGroup.add(fxGroup);

      // Microgravity spherical flame ball mesh
      const ballGeo = new THREE.SphereGeometry(0.85, 20, 20);
      const ballMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8, // Calm blue luminescent ball in 0g
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const flameBall = new THREE.Mesh(ballGeo, ballMat);
      fxGroup.add(flameBall);

      // Buoyant elongated teardrop flame cone
      const teardropGeo = new THREE.ConeGeometry(0.9, 2.4, 20);
      const teardropMat = new THREE.MeshBasicMaterial({
        color: 0xff6a2b, // Fiery orange/yellow in gravity
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const flameTeardrop = new THREE.Mesh(teardropGeo, teardropMat);
      flameTeardrop.position.y = 0.8;
      fxGroup.add(flameTeardrop);

      // Core point light
      const fireLight = new THREE.PointLight(0xff7722, 0, 10);
      fxGroup.add(fireLight);

      // Smoke billow particles
      const smokeCount = 35;
      const smokeGeo = new THREE.BufferGeometry();
      const smokePos = new Float32Array(smokeCount * 3);
      for (let i = 0; i < smokeCount * 3; i += 3) {
        smokePos[i] = (Math.random() - 0.5) * 1.5;
        smokePos[i + 1] = Math.random() * 2.5;
        smokePos[i + 2] = (Math.random() - 0.5) * 1.5;
      }
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
      const smokeMat = new THREE.PointsMaterial({
        color: 0x222222,
        size: 1.4,
        transparent: true,
        opacity: 0.0
      });
      const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
      fxGroup.add(smokeParticles);

      // Electrical arcing sparks (for fried electronics)
      const sparkCount = 20;
      const sparkGeo = new THREE.BufferGeometry();
      const sparkPos = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount * 3; i += 3) {
        sparkPos[i] = (Math.random() - 0.5) * 1.8;
        sparkPos[i + 1] = (Math.random() - 0.5) * 1.8;
        sparkPos[i + 2] = (Math.random() - 0.5) * 1.8;
      }
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
      const sparkMat = new THREE.PointsMaterial({
        color: 0x67e8f9,
        size: 0.8,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
      fxGroup.add(sparkParticles);

      // Decompression jet stream cone (when vented to vacuum)
      const ventGeo = new THREE.ConeGeometry(0.7, 4.5, 16);
      const ventMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const ventCone = new THREE.Mesh(ventGeo, ventMat);
      ventCone.position.set(2.4, 0, 0);
      ventCone.rotation.z = -Math.PI / 2;
      fxGroup.add(ventCone);

      moduleFireFX[key] = {
        group: fxGroup,
        flameBall,
        flameTeardrop,
        fireLight,
        smokeParticles,
        sparkParticles,
        ventCone
      };
    }

    // -------------------------------------------------------------
    // Solar Flare CME Shockwave Wavefront
    // -------------------------------------------------------------
    const cmeWaveGeo = new THREE.SphereGeometry(18, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const cmeWaveMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const cmeWave = new THREE.Mesh(cmeWaveGeo, cmeWaveMat);
    cmeWave.rotation.x = Math.PI / 2;
    cmeWave.position.set(0, 0, 80);
    scene.add(cmeWave);

    // -------------------------------------------------------------
    // View Modes: Hull, X-Ray, Thermal IR, Electrical Bus
    // -------------------------------------------------------------
    let currentViewMode = 'hull'; // 'hull', 'xray', 'thermal', 'electrical'

    function setViewMode(mode) {
      currentViewMode = mode;
      for (const [key, hull] of Object.entries(moduleMeshes)) {
        const interior = moduleInteriorMeshes[key];

        if (mode === 'hull') {
          hull.material.transparent = false;
          hull.material.opacity = 1.0;
          hull.material.wireframe = false;
          if (interior) interior.visible = false;
          primaryConduit.visible = true;
          backupConduit.visible = true;
        } else if (mode === 'xray') {
          hull.material.transparent = true;
          hull.material.opacity = 0.22;
          hull.material.wireframe = false;
          if (interior) interior.visible = true;
          primaryConduit.visible = true;
          backupConduit.visible = true;
        } else if (mode === 'thermal') {
          // Heat-vision false-color mode: blue (cool), yellow/orange (warm), white (hot fire)
          hull.material.transparent = false;
          hull.material.wireframe = false;
          if (interior) interior.visible = false;
          primaryConduit.visible = false;
          backupConduit.visible = false;
        } else if (mode === 'electrical') {
          hull.material.transparent = true;
          hull.material.opacity = 0.15;
          hull.material.wireframe = true;
          if (interior) interior.visible = true;
          primaryConduit.visible = true;
          backupConduit.visible = true;
        }
      }
    }

    // -------------------------------------------------------------
    // Camera Focus / Jump to Section
    // -------------------------------------------------------------
    function focusSection(sectionId) {
      if (!sectionCoords[sectionId]) return;
      const targetPos = sectionCoords[sectionId].clone();

      if (typeof gsap !== 'undefined') {
        gsap.to(camera.position, {
          x: targetPos.x + 10,
          y: targetPos.y + 6,
          z: targetPos.z + 12,
          duration: 1.2,
          ease: 'power2.inOut'
        });
        if (controls) {
          gsap.to(controls.target, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 1.2,
            ease: 'power2.inOut'
          });
        }
      } else {
        camera.position.set(targetPos.x + 10, targetPos.y + 6, targetPos.z + 12);
        if (controls) controls.target.copy(targetPos);
      }
    }

    // Reset camera to wide view
    function resetCamera() {
      if (typeof gsap !== 'undefined') {
        gsap.to(camera.position, { x: 22, y: 14, z: 28, duration: 1.2, ease: 'power2.inOut' });
        if (controls) gsap.to(controls.target, { x: 0, y: 0, z: -2, duration: 1.2, ease: 'power2.inOut' });
      } else {
        camera.position.set(22, 14, 28);
        if (controls) controls.target.set(0, 0, -2);
      }
    }

    // -------------------------------------------------------------
    // Render Loop & Animation Synchronization
    // -------------------------------------------------------------
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // 1. Habitation Centrifuge Ring Rotation synced to RPM
      // Angular velocity omega = RPM * 2*pi / 60 (rad/s)
      const omega = (simulation.centrifugeRpm * 2 * Math.PI) / 60;
      ringRotatingGroup.rotation.z += omega * delta;

      // Centrifuge unbalance wobble precession (nutation)
      if (simulation.gravityMetrics.wobbleRms > 0) {
        const wobbleRad = (simulation.gravityMetrics.wobbleRms * Math.PI) / 180;
        centrifugeGroup.rotation.x = Math.sin(time * 3.5) * wobbleRad;
        centrifugeGroup.rotation.y = Math.cos(time * 2.8) * wobbleRad;
      } else {
        centrifugeGroup.rotation.x = 0;
        centrifugeGroup.rotation.y = 0;
      }

      // 2. Celestial rotations
      planetMesh.rotation.y += 0.02 * delta;
      moonMesh.rotation.y += 0.01 * delta;

      // 3. Ion Thruster Plasma Plume Flicker
      const propSec = simulation.sections.propulsion;
      const propFiring = !propSec.abandoned && propSec.electronics.primary.online;
      for (const plume of plasmaPlumes) {
        if (propFiring) {
          plume.visible = true;
          const flicker = 0.55 + Math.sin(time * 24 + Math.random()) * 0.25;
          plume.scale.set(1 + Math.sin(time * 18) * 0.08, 1 + Math.cos(time * 22) * 0.15, 1);
          plume.material.opacity = flicker;
        } else {
          plume.visible = false;
        }
      }

      // 4. Update Fire, Smoke, Sparks, and Vent FX per module
      for (const [key, sec] of Object.entries(simulation.sections)) {
        const fx = moduleFireFX[key];
        const hull = moduleMeshes[key];
        if (!fx) continue;

        // Effective gravity in this module
        const localG = key === 'centrifuge' ? simulation.gravityMetrics.artificialG : 0.0;
        const isMicroG = localG < 0.05;

        // Fire rendering
        if (sec.burning && sec.fireSize > 0) {
          const sz = sec.fireSize;
          fx.fireLight.intensity = sz * 2.5;

          if (isMicroG) {
            // Microgravity: Spherical blue diffusion flame ball!
            fx.flameBall.visible = true;
            fx.flameTeardrop.visible = false;

            const pulse = 1.0 + Math.sin(time * 4) * 0.08;
            fx.flameBall.scale.set(sz * pulse, sz * pulse, sz * pulse);
            fx.flameBall.material.opacity = Math.min(0.85, sz * 0.9);
            // If cool flame, very faint infrared blue/purple
            fx.flameBall.material.color.setHex(sec.coolFlame ? 0x818cf8 : 0x38bdf8);
            fx.fireLight.color.setHex(sec.coolFlame ? 0x6366f1 : 0x0ea5e9);
          } else {
            // Artificial Gravity (>0g): Elongated flickering orange/yellow teardrop!
            fx.flameBall.visible = false;
            fx.flameTeardrop.visible = true;

            const flickerX = 1.0 + Math.sin(time * 14) * 0.12;
            const flickerY = 1.0 + Math.sin(time * 18 + 1.2) * 0.22;
            fx.flameTeardrop.scale.set(sz * flickerX, sz * flickerY * (1 + Math.sqrt(localG) * 0.6), sz * flickerX);
            fx.flameTeardrop.material.opacity = Math.min(0.9, sz * 1.1);
            fx.flameTeardrop.material.color.setHex(0xff6a2b);
            fx.fireLight.color.setHex(0xff7722);
          }

          // Smoke particles
          fx.smokeParticles.visible = true;
          fx.smokeParticles.material.opacity = Math.min(0.65, sec.smokeDensity * 1.8);

          // Animate smoke rising or diffusing
          const posAttr = fx.smokeParticles.geometry.attributes.position;
          for (let i = 1; i < posAttr.array.length; i += 3) {
            posAttr.array[i] += (isMicroG ? 0.005 : 0.025 * localG);
            if (posAttr.array[i] > 3.0) posAttr.array[i] = 0;
          }
          posAttr.needsUpdate = true;
        } else {
          fx.flameBall.visible = false;
          fx.flameTeardrop.visible = false;
          fx.fireLight.intensity = 0;
          fx.smokeParticles.visible = false;
        }

        // Fried electronics electrical sparking FX
        const pFried = sec.electronics.primary.status === 'FRIED';
        if (pFried && Math.random() < 0.25) {
          fx.sparkParticles.visible = true;
          fx.sparkParticles.material.opacity = 0.85;
          const sPos = fx.sparkParticles.geometry.attributes.position;
          for (let i = 0; i < sPos.array.length; i++) {
            sPos.array[i] += (Math.random() - 0.5) * 0.35;
          }
          sPos.needsUpdate = true;
        } else {
          fx.sparkParticles.visible = false;
        }

        // Decompression vacuum vent gas jet
        if (sec.vented && sec.pressure > 2.0) {
          fx.ventCone.visible = true;
          fx.ventCone.material.opacity = Math.min(0.85, (sec.pressure / 101.3) * 0.9);
          fx.ventCone.scale.set(1, 1 + Math.sin(time * 20) * 0.2, 1);
        } else {
          fx.ventCone.visible = false;
        }

        // Thermal View Mode Color Override
        if (currentViewMode === 'thermal' && hull) {
          if (sec.burning) {
            hull.material.color.setHex(0xffffff); // Hot incandescent white
          } else if (sec.temperature > 80) {
            hull.material.color.setHex(0xf43f5e); // Hot red/pink
          } else if (sec.temperature > 40) {
            hull.material.color.setHex(0xfb923c); // Warm orange
          } else if (sec.temperature > 26) {
            hull.material.color.setHex(0xfacc15); // Moderate yellow
          } else {
            hull.material.color.setHex(0x1e3a8a); // Cool ambient blue
          }
        } else if (currentViewMode === 'hull' && hull) {
          // Normal hull color, with red border/tint if abandoned or on fire
          if (sec.abandoned) {
            hull.material.color.setHex(0x451a1a); // Dark warning red/brown
          } else if (sec.burning) {
            hull.material.color.setHex(0x7f1d1d);
          } else if (key === 'avionics') {
            hull.material.color.setHex(0xf59e0b); // Gold foil
          } else if (key === 'reactor') {
            hull.material.color.setHex(0x1e293b);
          } else {
            hull.material.color.setHex(0x94a3b8);
          }
        }
      }

      // 5. Solar Flare CME Wavefront sweeping animation
      if (simulation.flareActive) {
        cmeWave.visible = true;
        cmeWave.position.z -= 45 * delta;
        cmeWave.material.opacity = Math.min(0.7, cmeWave.material.opacity + 0.1);
        if (cmeWave.position.z < -40) {
          cmeWave.position.z = 80;
        }
      } else {
        cmeWave.material.opacity = Math.max(0, cmeWave.material.opacity - 0.05);
        if (cmeWave.material.opacity === 0) cmeWave.visible = false;
      }

      // 6. Update OrbitControls
      if (controls) controls.update();

      renderer.render(scene, camera);
    }

    animate();

    // Window resize handler
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
      scene,
      camera,
      renderer,
      controls,
      setViewMode,
      focusSection,
      resetCamera,
      destroy() {
        window.removeEventListener('resize', handleResize);
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }

  window.initSpacecraft3D = initSpacecraft3D;
})(window);
