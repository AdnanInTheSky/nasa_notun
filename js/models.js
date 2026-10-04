/**
 * FlameAtlas Computational Models
 * Stand-ins for /risk, /rank, /gravity, /regime, /gaps, and earth impact physics.
 */

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function seeded(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gravityFactor = (g) => 0.72 + 0.55 * Math.sin((Math.PI * clamp(g)) / 1.25);

function shapFor(material, { o2, pressure, gravity }) {
  const o2Eff = (o2 - 21) * 0.018;
  const pEff = -(14.7 - pressure) * 0.006 + (o2 > 30 ? 0.02 : 0);
  const gEff = (gravityFactor(gravity) - 1) * 0.28;
  const matEff = (material.base - 0.5) * 0.7;
  const loiEff = -(material.loi - 21) * 0.004;
  return [
    { feature: 'Oxygen %', value: +o2Eff.toFixed(3) },
    { feature: 'Material chemistry', value: +matEff.toFixed(3) },
    { feature: 'Oxygen index (LOI)', value: +loiEff.toFixed(3) },
    { feature: 'Gravity level', value: +gEff.toFixed(3) },
    { feature: 'Pressure', value: +pEff.toFixed(3) },
  ];
}

function materialRisk(material, cond) {
  const sum = shapFor(material, cond).reduce((a, s) => a + s.value, 0);
  return clamp(0.42 + sum);
}

function rankMaterials(materials, cond, ids = null) {
  const subset = ids ? materials.filter((m) => ids.includes(m.id)) : materials;
  return subset
    .map((m) => {
      const risk = materialRisk(m, cond);
      const burnsAbove = Math.max(10, Math.round(m.loi - (cond.gravity > 0 ? 2 : 0) - (14.7 - cond.pressure) * 0.3));
      return { ...m, risk, burnsAbove, selfExtinguishes: cond.o2 < burnsAbove };
    })
    .sort((a, b) => b.risk - a.risk);
}

function cabinRisk(materials, cond) {
  const ranked = rankMaterials(materials, cond);
  if (!ranked.length) return 50;
  const avg = ranked.reduce((a, m) => a + m.risk, 0) / ranked.length;
  return Math.round(clamp(avg * 1.15) * 100);
}

const riskLevel = (r) =>
  r >= 0.7
    ? { label: 'Critical', tone: 'critical' }
    : r >= 0.5
      ? { label: 'High', tone: 'high' }
      : r >= 0.3
        ? { label: 'Moderate', tone: 'moderate' }
        : { label: 'Low', tone: 'low' };

function gravityCurve(material) {
  const scale = 0.6 + material.base * 3.2;
  const pts = [];
  for (let i = 0; i <= 50; i++) {
    const g = i / 50;
    const mean = scale * gravityFactor(g);
    const dist = Math.min(g, 1 - g);
    const sd = 0.05 * scale + dist * 0.9 * scale * 0.55;
    pts.push({ g: +g.toFixed(2), mean: +mean.toFixed(3), band: [+(mean - sd).toFixed(3), +(mean + sd).toFixed(3)] });
  }
  return pts;
}

function gravityObservations(material) {
  const rnd = seeded(material.id);
  const scale = 0.6 + material.base * 3.2;
  const obs = [];
  [0, 0, 0.01, 0.02, 0.05].forEach((g) => obs.push({ g, obs: +(scale * gravityFactor(g) * (0.92 + rnd() * 0.16)).toFixed(3) }));
  [0.95, 1, 1, 1].forEach((g) => obs.push({ g, obs: +(scale * gravityFactor(g) * (0.92 + rnd() * 0.16)).toFixed(3) }));
  return obs;
}

function predictAt(material, g) {
  const curve = gravityCurve(material);
  const idx = Math.round(clamp(g) * 50);
  return curve[idx];
}

const FUEL_SHIFT = { heptane: 0, decane: 1.5, dodecane: 3, methanol: -2.5 };
const DILUENT_SHIFT = { n2: 0, co2: 4, he: 2 };

function regimeAt(o2, atm, fuelId, diluentId) {
  const shift = (FUEL_SHIFT[fuelId] || 0) + (DILUENT_SHIFT[diluentId] || 0);
  const extinctLimit = 13 + shift - (atm - 1) * 2.2;
  const coolWidth = 4.5 + (fuelId === 'methanol' ? -2.5 : 0) + (diluentId === 'co2' ? 1.8 : 0) + atm * 0.6;
  if (o2 < extinctLimit) return 'extinct';
  if (o2 < extinctLimit + coolWidth) return 'cool';
  return 'hot';
}

function gapGrid(gapG = [1, 0.75, 0.5, 0.38, 0.16, 0.05, 0], gapO2 = [15, 18, 21, 24, 27, 30, 34, 38]) {
  const rnd = seeded('gaps');
  return gapG.map((g) =>
    gapO2.map((o2) => {
      let n = 0;
      if (g === 0) n = Math.round(4 + rnd() * 22 * (o2 <= 30 ? 1 : 0.25));
      else if (g === 1) n = Math.round(6 + rnd() * 30 * (o2 <= 34 ? 1 : 0.4));
      else if (g === 0.05) n = o2 <= 24 ? Math.round(rnd() * 4) : 0;
      else if (g === 0.16) n = o2 === 21 ? 1 : 0;
      else n = 0;
      return { g, o2, n };
    })
  );
}

// Earth Impact Physics
const AU_KM = 1.496e8;
const fluxFromLevel = (level) => 10 ** (level - 8);
function classFromLevel(level) {
  const flux = fluxFromLevel(level);
  const letters = [
    ['X', 1e-4],
    ['M', 1e-5],
    ['C', 1e-6],
    ['B', 1e-7],
    ['A', 1e-8],
  ];
  const [letter, base] = letters.find(([, b]) => flux >= b) || letters[4];
  return `${letter}${(flux / base).toFixed(1)}`;
}

const HIT = { direct: 1, glancing: 0.5, miss: 0 };

const lerpTable = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
};

const scaleFrom = (value, steps) => steps.reduce((lvl, s, i) => (value >= s ? i + 1 : lvl), 0);

function earthImpact(inp) {
  const hit = HIT[inp.hit] ?? 0;
  const flux = fluxFromLevel(inp.level);
  const R = scaleFrom(flux, [1e-5, 5e-5, 1e-4, 1e-3, 2e-3]);
  const pfu = 10 ** (1.5 * (inp.level - 2.6)) * (0.3 + 0.7 * hit) * (inp.speed / 1000);
  const S = scaleFrom(pfu, [10, 100, 1e3, 1e4, 1e5]);
  const v = inp.speed * hit + 400 * (1 - hit);
  const n = inp.density * hit + 5 * (1 - hit);
  const bz = inp.bz * hit;
  const bs = Math.max(0, -bz);
  const dst = hit > 0 ? -(0.01 * v * bs + 20 * hit) : -8;
  const kp = Math.min(
    9,
    lerpTable(
      [
        [0, 1],
        [-30, 3],
        [-50, 5],
        [-100, 6],
        [-150, 7],
        [-250, 8],
        [-350, 9],
      ].map(([d, k]) => [-d, k]),
      -dst,
    ),
  );
  const G = kp >= 9 ? 5 : kp >= 8 ? 4 : kp >= 7 ? 3 : kp >= 6 ? 2 : kp >= 5 ? 1 : 0;
  const P = 1.6726e-6 * n * v * v;
  const rmp = (10.22 + 1.29 * Math.tanh(0.184 * (bz + 8.14))) * P ** (-1 / 6.6);
  const auroraLat = clamp(66.5 - 3.4 * kp - Math.max(0, (-dst - 400) / 80), 18, 70);
  const cityAbs = Math.abs(inp.cityLat);
  const aurora = cityAbs >= auroraLat ? 'overhead' : cityAbs >= auroraLat - 5 ? 'horizon' : 'no';
  const vAvg = 400 + (inp.speed - 400) * 0.8;
  const arrivalHours = AU_KM / vAvg / 3600;

  const gpsErr = Math.round(1 + kp * kp * 0.55 + S * 2);
  const drag = Math.round(8 * kp ** 1.6);
  const geoExposed = rmp < 6.6;
  const impacts = {
    radio: { score: R * 20, detail: R ? `Shortwave radio fades on sunny side for ~${[0, 10, 30, 60, 120, 180][R]} min` : 'Radios work normally' },
    gps: { score: clamp(gpsErr / 45) * 100, detail: `GPS can be off by about ${gpsErr} m` },
    satellites: {
      score: clamp(drag / 250 + (geoExposed ? 0.4 : 0) + S * 0.06) * 100,
      detail: geoExposed ? `Shield squeezed inside GEO orbit! Satellites exposed. Drag +${drag}%` : `Air drag on low satellites +${drag}%`,
    },
    power: {
      score: clamp(-dst / 700) * 100,
      detail: -dst > 500 ? 'Big risk of blackouts from induced currents' : -dst > 200 ? 'Power grid operators on alert' : 'Power grids are fine',
    },
    astronauts: {
      score: S * 20,
      detail: S >= 3 ? 'Astronauts must shelter in shielded areas' : S >= 1 ? 'Extra radiation: spacewalks postponed' : 'Normal radiation levels',
    },
    flights: { score: (S >= 2 || R >= 3 ? 55 : 0) + S * 9, detail: S >= 2 || R >= 3 ? 'Polar flights rerouted to lower routes' : 'Flights normal' },
  };
  const overall = Math.round(
    clamp(
      (impacts.radio.score * 0.12 +
        impacts.gps.score * 0.12 +
        impacts.satellites.score * 0.2 +
        impacts.power.score * 0.26 +
        impacts.astronauts.score * 0.18 +
        impacts.flights.score * 0.12) /
        100,
    ) * 100,
  );

  return {
    R,
    S,
    G,
    kp,
    dst: Math.round(dst),
    pfu,
    rmp,
    auroraLat,
    aurora,
    arrivalHours,
    impacts,
    overall,
    geoExposed,
    classType: classFromLevel(inp.level),
    hit,
  };
}

function inputsFromFlare(flare) {
  const abs = Math.abs(flare.lon);
  return {
    level: Math.log10(flare.flux) + 8,
    hit: !flare.hasCME ? 'miss' : abs < 35 ? 'direct' : abs < 70 ? 'glancing' : 'miss',
    speed: flare.hasCME ? Math.round(500 + (Math.log10(flare.flux) + 6) * 400) : 420,
    bz: flare.hasCME ? -12 : 0,
    density: flare.hasCME ? 15 : 6,
  };
}

// Flame Lab Physics
const GRAVITY_SIZE = [
  [0, 0.62],
  [0.16, 1.0],
  [0.38, 1.08],
  [1, 0.95],
];

function computeFlame({ gravity, o2, material }) {
  const g = clamp(gravity);
  const sg = Math.sqrt(g);
  const canBurn = o2 >= material.loi;
  const oxy = clamp((o2 - material.loi) / 14 + 0.35, 0.3, 1.4);
  const size = canBurn ? material.flam * oxy * lerpTable(GRAVITY_SIZE, g) : 0;
  const blueness = 1 - clamp(sg * 1.15);

  return {
    material,
    canBurn,
    size,
    radius: 0.22 + 0.33 * size,
    stretch: 1 + 1.3 * sg,
    taper: clamp(sg * 1.4),
    blueness,
    soot: 0.25 + 0.75 * (1 - blueness),
    flow: 0.18 + 0.82 * sg,
    smokeRise: 1.7 * g,
    shape: g < 0.02 ? 'Round ball' : g < 0.5 ? 'Short and wide' : 'Tall teardrop',
    colorName: blueness > 0.6 ? 'Blue and dim' : blueness > 0.25 ? 'Orange, blue base' : 'Bright yellow',
    oxygenSpeed: g < 0.02 ? 'Slow drift' : g < 0.5 ? 'Gentle breeze' : 'Fast breeze',
    smokeGoes: g < 0.02 ? 'Everywhere, slowly' : 'Up to the ceiling',
  };
}

function dangerLevel(size, burning) {
  if (!burning || size <= 0) return { label: 'Safe', tone: 'low', pct: 0 };
  const pct = Math.round(clamp(size / 1.4) * 100);
  if (size > 0.9) return { label: 'Danger!', tone: 'critical', pct };
  if (size > 0.55) return { label: 'Watch out', tone: 'high', pct };
  return { label: 'Small', tone: 'moderate', pct };
}

function explain(state, flame) {
  const { status, gravity: g, o2, coolFlame, heatVision, fizzled, burnedOut } = state;
  const m = flame.material;

  if (status === 'extinguishing') {
    return {
      title: 'Whoosh! Carbon dioxide',
      text: 'The extinguisher sprays CO₂, a heavy gas that pushes oxygen away from the fuel. No oxygen means the fire triangle is broken.',
      word: { term: 'Suppressant', meaning: 'Anything that puts out a fire, like CO₂, water mist or foam.' },
    };
  }
  if (status === 'out' && coolFlame && !heatVision) {
    return {
      title: 'Is it really out?',
      text: 'It looks like the fire is gone… but in space some fuel drops keep burning as an invisible "cool flame". Switch on Heat vision to check!',
      word: { term: 'Cool flame', meaning: 'A flame at about 500 °C instead of 1,500 °C. It gives off almost no light.' },
    };
  }
  if (status === 'out' && coolFlame && heatVision) {
    return {
      title: 'Found it: a hidden cool flame!',
      text: 'Heat vision shows the flame our eyes miss. NASA discovered these on the space station in the FLEX experiment. Astronauts need special sensors to spot them.',
      word: { term: 'Infrared', meaning: 'A kind of light we feel as heat but cannot see. Heat cameras can see it.' },
    };
  }
  if ((status === 'out' || status === 'fizzle') && fizzled) {
    return {
      title: "It won't stay lit!",
      text: `${m.name} needs at least ${m.loi}% oxygen to keep burning. This air has only ${o2}%. ${m.loi > 25 ? 'That is why fire-safe materials protect astronauts.' : 'Try adding more oxygen.'}`,
      word: { term: 'Oxygen index', meaning: 'The smallest amount of oxygen a material needs to keep burning.' },
    };
  }
  if (status === 'out' && burnedOut) {
    return {
      title: 'All burned up',
      text: 'The fire used up all of its fuel, so it stopped. Remove the fuel and a fire cannot keep going. Press Reset for a new sample.',
      word: { term: 'Fuel', meaning: 'Anything that can burn: paper, cloth, plastic or liquid fuel.' },
    };
  }
  if (status === 'out') {
    return {
      title: 'Fire is out. Great job!',
      text: 'You stopped the fire. On a real spacecraft, astronauts would also switch off fans so fresh air stops feeding any leftover flames.',
      word: { term: 'Ventilation', meaning: 'Fans that move air around. In space, fans are the only "wind".' },
    };
  }
  if (status === 'burning' && g < 0.02) {
    return {
      title: 'A floating fire ball!',
      text: 'In space, hot air does not rise because there is no "up". The flame spreads evenly in every direction and becomes a ball. Fresh oxygen only drifts in slowly, so the flame is small, cool and blue.',
      word: { term: 'Microgravity', meaning: 'When things feel almost weightless, like on the space station.' },
    };
  }
  if (status === 'burning' && g < 0.5) {
    return {
      title: 'A wide, hungry flame',
      text: `Gravity here is weak, so hot air rises gently. That soft breeze feeds the fire with oxygen without cooling it much, so some materials burn even better than on Earth!${o2 > 25 ? ' The extra oxygen in the base makes it hungrier still.' : ''}`,
      word: { term: 'Buoyancy', meaning: 'Hot air is lighter than cold air, so gravity lets it float upward.' },
    };
  }
  if (status === 'burning') {
    return {
      title: 'Hot air rises!',
      text: 'On Earth, gravity pulls heavy cold air down, and the light hot air from the fire rises up. This pulls the flame into a pointy teardrop. Tiny glowing bits of soot make it yellow.',
      word: { term: 'Convection', meaning: 'Heat moving around because warm air or water rises and cool air sinks.' },
    };
  }
  return {
    title: 'Ready for an experiment',
    text: 'Pick a place and something to burn, then press "Light it!" or click the sample. Every fire needs fuel, heat and oxygen. Together they make the fire triangle.',
    word: { term: 'Fire triangle', meaning: 'Fuel + heat + oxygen. Take away any one and the fire goes out.' },
  };
}

const FlameModels = {
  clamp,
  seeded,
  shapFor,
  materialRisk,
  rankMaterials,
  cabinRisk,
  riskLevel,
  gravityCurve,
  gravityObservations,
  predictAt,
  regimeAt,
  gapGrid,
  fluxFromLevel,
  classFromLevel,
  HIT,
  earthImpact,
  inputsFromFlare,
  computeFlame,
  dangerLevel,
  explain,
};

if (typeof window !== 'undefined') {
  window.FlameModels = FlameModels;
  Object.assign(window, FlameModels);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlameModels;
}
