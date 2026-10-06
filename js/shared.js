/**
 * FlameAtlas Shared Core Logic
 * Handles global state (Phase, Kids Mode, Sound, XP, Badges, Sparky, Toasts) with Alpine.js
 */

// Sound effects synthesizer via Web Audio
let audioCtx = null;
let soundEnabled = localStorage.getItem('flameatlas_sound') !== 'false';

function getAudioContext() {
  if (!soundEnabled || typeof window === 'undefined') return null;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function playTone(freq, start, dur, { type = 'sine', vol = 0.12, slide = 0 } = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) {}
}

const sfx = {
  pop: () => playTone(620, 0, 0.08, { type: 'triangle', vol: 0.06, slide: 200 }),
  ding: () => {
    playTone(880, 0, 0.18, { vol: 0.09 });
    playTone(1320, 0.08, 0.25, { vol: 0.07 });
  },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => playTone(f, i * 0.11, 0.3, { type: 'triangle', vol: 0.1 })),
  whoosh: () => playTone(200, 0, 0.5, { type: 'sawtooth', vol: 0.04, slide: 900 }),
  oops: () => playTone(300, 0, 0.25, { type: 'square', vol: 0.05, slide: -150 }),
};

if (typeof window !== 'undefined') window.sfx = sfx;

// Sparky Robot Mascot SVG generator
function renderSparkySvg(size = 72, mood = 'happy') {
  return `
    <svg viewBox="0 0 120 130" width="${size}" height="${(size * 130) / 120}" class="animate-float" aria-hidden="true">
      <defs>
        <linearGradient id="sp-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#cfd8ee"/>
        </linearGradient>
        <linearGradient id="sp-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#ff6a2b"/>
          <stop offset="1" stop-color="#ffd23f"/>
        </linearGradient>
        <radialGradient id="sp-visor" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#4fe0ff"/>
          <stop offset="1" stop-color="#1a3f8f"/>
        </radialGradient>
      </defs>
      <!-- Antenna flame -->
      <path d="M60 6 C66 14 70 18 66 26 C64 30 56 30 54 26 C50 18 56 14 60 6 Z" fill="url(#sp-flame)"/>
      <rect x="57" y="26" width="6" height="10" rx="3" fill="#8a96b8"/>
      <!-- Head -->
      <rect x="22" y="34" width="76" height="56" rx="26" fill="url(#sp-body)" stroke="#8a96b8" stroke-width="2"/>
      <rect x="31" y="44" width="58" height="36" rx="18" fill="url(#sp-visor)"/>
      <!-- Eyes -->
      <path d="M44 62 q6 -8 12 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M64 62 q6 -8 12 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- Mouth & cheeks -->
      <path d="M52 71 q8 6 16 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="36" cy="72" r="4" fill="#ff8fa3" opacity="0.7"/>
      <circle cx="84" cy="72" r="4" fill="#ff8fa3" opacity="0.7"/>
      <!-- Torso -->
      <rect x="36" y="92" width="48" height="30" rx="14" fill="url(#sp-body)" stroke="#8a96b8" stroke-width="2"/>
      <circle cx="60" cy="106" r="7" fill="#ff6a2b"/>
      <path d="M57 106 l3 -5 l3 5 l-3 3 z" fill="#ffd23f"/>
      <!-- Arms -->
      <rect x="20" y="96" width="16" height="9" rx="4.5" fill="#cfd8ee" stroke="#8a96b8" stroke-width="2"/>
      <rect x="84" y="96" width="16" height="9" rx="4.5" fill="#cfd8ee" stroke="#8a96b8" stroke-width="2"/>
    </svg>
  `;
}

// Global Alpine Store
function getFlameAtlasStore() {
  return {
    // Phases
    phases: [
      { id: 'moon', name: 'Moon Base', gravity: 0.16, o2: 34, pressure: 8.2, commDelay: '1.3 s', note: 'Proposed 8.2 psi / 34% O₂ habitat — materials ignite more easily.' },
      { id: 'mars', name: 'Mars Habitat', gravity: 0.38, o2: 28, pressure: 9.5, commDelay: '14 min', note: 'Partial gravity allows buoyant convection; communication lag delays ground response.' },
      { id: 'transit', name: 'Deep Space Transit', gravity: 0.0, o2: 21, pressure: 14.7, commDelay: 'Variable', note: 'Zero-g spherical flames, slow burning, high toxic soot buildup.' },
      { id: 'iss', name: 'ISS Low Earth Orbit', gravity: 0.0, o2: 21, pressure: 14.7, commDelay: '< 1 s', note: 'Microgravity testbed with immediate ground support.' },
      { id: 'gateway', name: 'Lunar Gateway', gravity: 0.0, o2: 30, pressure: 10.2, commDelay: '1.3 s', note: 'Outside Earth magnetosphere with intermittent crew presence.' }
    ],
    currentPhaseId: localStorage.getItem('flameatlas_phase') || 'moon',
    get currentPhase() {
      return this.phases.find((p) => p.id === this.currentPhaseId) || {
        id: 'moon',
        name: 'Moon',
        gravity: 0.16,
        o2: 34,
        pressure: 8.2,
        commDelay: '1.3 s',
        note: 'Proposed 8.2 psi / 34% O₂ habitat — materials ignite more easily.'
      };
    },
    setPhase(id) {
      this.currentPhaseId = id;
      localStorage.setItem('flameatlas_phase', id);
      sfx.pop();
      window.dispatchEvent(new CustomEvent('phase-changed', { detail: this.currentPhase }));
    },

    // Kids mode (defaults to true as per spec)
    kids: localStorage.getItem('flameatlas_kids') !== 'false',
    toggleKids() {
      this.kids = !this.kids;
      localStorage.setItem('flameatlas_kids', this.kids);
      document.documentElement.toggleAttribute('data-kids', this.kids);
      sfx.pop();
    },

    // Sound toggle
    sound: soundEnabled,
    toggleSound() {
      this.sound = !this.sound;
      soundEnabled = this.sound;
      localStorage.setItem('flameatlas_sound', this.sound);
    },

    // Game stats & XP
    xp: Number(localStorage.getItem('flameatlas_xp') || 0),
    badges: JSON.parse(localStorage.getItem('flameatlas_badges') || '[]'),
    stats: JSON.parse(localStorage.getItem('flameatlas_stats') || '{}'),
    levels: [
      { level: 1, title: 'Cadet', xp: 0 },
      { level: 2, title: 'Spark Spotter', xp: 60 },
      { level: 3, title: 'Flame Tracker', xp: 150 },
      { level: 4, title: 'Fire Scientist', xp: 280 },
      { level: 5, title: 'Habitat Guardian', xp: 450 },
      { level: 6, title: 'Mission Fire Chief', xp: 680 }
    ],
    allBadges: [
      { id: 'first-light', name: 'First Light', icon: 'flame', desc: 'Ignite your first simulated flame.' },
      { id: 'space-ball', name: 'Fire Sphere', icon: 'circle-dot', desc: 'Create a spherical flame in zero gravity.' },
      { id: 'moon-fire', name: 'Moon Flame', icon: 'moon', desc: 'Test material combustion under lunar gravity.' },
      { id: 'firefighter', name: 'CO₂ Suppressor', icon: 'shield-alert', desc: 'Successfully extinguish a fire using CO₂.' },
      { id: 'ghost-buster', name: 'Cool Flame Hunter', icon: 'eye', desc: 'Spot a hidden low-temp flame with infrared.' },
      { id: 'alarm-raiser', name: 'Safety Sentinel', icon: 'bell-ring', desc: 'Trigger early warning cabin smoke sensors.' },
      { id: 'risk-reader', name: 'Risk Analyst', icon: 'gauge', desc: 'Identify the highest-risk mission habitat.' },
      { id: 'explorer', name: 'Mission Specialist', icon: 'compass', desc: 'Survey all five spaceflight mission environments.' }
    ],
    allMissions: [],

    get currentLevel() {
      let cur = this.levels[0];
      for (const l of this.levels) {
        if (this.xp >= l.xp) cur = l;
      }
      const next = this.levels.find((l) => l.xp > this.xp);
      const progress = next ? (this.xp - cur.xp) / (next.xp - cur.xp) : 1;
      return { ...cur, next, progress: Math.min(1, Math.max(0, progress)) };
    },

    addXp(amount, reason = '') {
      const prevLevel = this.currentLevel.level;
      this.xp += amount;
      localStorage.setItem('flameatlas_xp', this.xp);
      const newLevel = this.currentLevel.level;
      if (reason) {
        this.toast('xp', `+${amount} XP`, reason);
        sfx.ding();
      }
      if (newLevel > prevLevel) {
        setTimeout(() => {
          this.toast('level', `Level Up! Level ${newLevel}`, this.currentLevel.title);
          sfx.fanfare();
        }, 300);
      }
    },

    unlockBadge(badgeId) {
      if (this.badges.includes(badgeId)) return false;
      const b = this.allBadges.find((x) => x.id === badgeId);
      if (!b) return false;
      this.badges.push(badgeId);
      localStorage.setItem('flameatlas_badges', JSON.stringify(this.badges));
      this.toast('badge', 'Badge Unlocked!', b.name);
      this.addXp(40);
      sfx.fanfare();
      if (typeof confetti === 'function') {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.3 } });
      }
      return true;
    },

    bumpStat(key, by = 1) {
      this.stats[key] = (this.stats[key] || 0) + by;
      localStorage.setItem('flameatlas_stats', JSON.stringify(this.stats));
      return this.stats[key];
    },

    // Trophy Room Modal
    trophyOpen: false,
    toggleTrophy() {
      this.trophyOpen = !this.trophyOpen;
      sfx.pop();
    },

    // Mobile Menu
    mobileMenuOpen: false,
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
      sfx.pop();
    },

    // Sparky Tips & Welcome
    sparkyVisible: true,
    sparkySpeechOpen: true,
    welcomeOpen: false,
    currentSectionKey: 'overview',
    toggleSparky() {
      this.sparkySpeechOpen = !this.sparkySpeechOpen;
      sfx.pop();
    },

    // Toast notifications
    toasts: [],
    toast(kind, title, text) {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, kind, title, text });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, kind === 'badge' ? 4500 : 2500);
    },

    // Initializer
    async init() {
      document.documentElement.toggleAttribute('data-kids', this.kids);

      // Check first visit welcome
      if (!localStorage.getItem('flameatlas_welcomed')) {
        this.welcomeOpen = true;
      }

      // Load data
      try {
        const [missionsRes, gameRes] = await Promise.all([
          fetch('./data/missions.json'),
          fetch('./data/game.json')
        ]);
        if (missionsRes.ok) this.phases = await missionsRes.json();
        if (gameRes.ok) {
          const gameData = await gameRes.json();
          this.levels = gameData.levels || this.levels;
          this.allBadges = gameData.badges || [];
          this.allMissions = gameData.missions || [];
          this.kidSections = gameData.kidSections || {};
        }
      } catch (e) {
        console.warn('Fallback loading data:', e);
      }
    },

    closeWelcome() {
      this.welcomeOpen = false;
      localStorage.setItem('flameatlas_welcomed', 'true');
      sfx.pop();
    }
  };
}

let appStoreRegistered = false;
function registerFlameAtlasStore() {
  if (appStoreRegistered) return;
  if (typeof Alpine !== 'undefined' && typeof Alpine.store === 'function') {
    try {
      Alpine.store('app', getFlameAtlasStore());
      appStoreRegistered = true;
      if (typeof window !== 'undefined') {
        injectMobileNav();
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 100);
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 600);
      }
    } catch (e) {
      console.warn('Store registration:', e);
    }
  }
}

// Multi-stage registration hooks
document.addEventListener('alpine:init', registerFlameAtlasStore);
if (typeof Alpine !== 'undefined' && typeof Alpine.store === 'function') {
  registerFlameAtlasStore();
}
document.addEventListener('DOMContentLoaded', registerFlameAtlasStore);
window.addEventListener('load', registerFlameAtlasStore);

if (typeof window !== 'undefined') {
  window.renderSparkySvg = renderSparkySvg;
  window.getFlameAtlasStore = getFlameAtlasStore;
  window.registerFlameAtlasStore = registerFlameAtlasStore;
}

function injectMobileNav() {
  if (typeof document === 'undefined') return;

  const currentPath = (typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '');
  const isPage = (name) => {
    if (name === 'index') return currentPath === '/' || currentPath.endsWith('/') || currentPath.includes('index');
    return currentPath.includes(name);
  };

  // 1. Mobile Drawer Navigation
  if (!document.getElementById('mobile-nav-drawer')) {
    const drawer = document.createElement('div');
    drawer.id = 'mobile-nav-drawer';
    drawer.setAttribute('x-show', '$store.app.mobileMenuOpen');
    drawer.setAttribute('x-transition.opacity', '');
    drawer.className = 'fixed inset-0 z-50 flex md:hidden bg-slate-950/85 backdrop-blur-md';
    drawer.style.display = 'none';
    drawer.innerHTML = `
      <div class="w-80 max-w-[85vw] bg-slate-950 border-r border-slate-800 p-5 flex flex-col justify-between h-full overflow-y-auto"
           @click.outside="$store.app.mobileMenuOpen = false">
        <div>
          <!-- Header -->
          <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <a href="index.html" class="flex items-center gap-2.5 font-bold text-white text-base">
              <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-400 p-0.5 flex items-center justify-center">
                <i data-lucide="flame" class="w-4 h-4 text-white"></i>
              </div>
              <div>
                <span class="block leading-tight">FlameAtlas</span>
                <span class="text-[10px] text-slate-400 font-mono" x-text="$store.app.kids ? 'Kids Adventure' : 'NASA Space Apps'"></span>
              </div>
            </a>
            <button @click="$store.app.mobileMenuOpen = false" class="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-900 border border-slate-800">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Quick Controls Pill in Drawer -->
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 mb-5 text-xs">
            <button @click="$store.app.toggleKids()" class="flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 font-semibold transition-colors"
                    :class="$store.app.kids ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-cyan-400"></i>
              <span x-text="$store.app.kids ? 'Kids Mode' : 'Pro Mode'"></span>
            </button>
            <button @click="$store.app.toggleSound()" class="p-1.5 rounded-lg text-slate-400 hover:text-white">
              <i :data-lucide="$store.app.sound ? 'volume-2' : 'volume-x'" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Navigation Groups -->
          <nav class="space-y-4 text-sm font-medium">
            <div>
              <p class="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 mb-1.5">Core Missions</p>
              <div class="space-y-1">
                <a href="index.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('index') ? 'bg-orange-500/15 text-orange-400 font-semibold border border-orange-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="gauge" class="w-4 h-4 text-orange-400"></i>
                  <span x-text="$store.app.kids ? 'Mission Map' : 'Mission Overview'"></span>
                </a>
                <a href="flame-lab.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('flame-lab') ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="flask-conical" class="w-4 h-4 text-cyan-400"></i>
                  <span x-text="$store.app.kids ? 'Fire Lab 3D' : 'Flame Lab 3D'"></span>
                </a>
                <a href="space-craft.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('space-craft') ? 'bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="rocket" class="w-4 h-4 text-rose-400"></i>
                  <span x-text="$store.app.kids ? 'Spacecraft Fire Sim' : 'Spacecraft Simulation'"></span>
                </a>
                <a href="solar-watch.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('solar-watch') ? 'bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="sun" class="w-4 h-4 text-amber-400"></i>
                  <span x-text="$store.app.kids ? 'Sun Blasts' : 'Solar Flare Watch'"></span>
                </a>
                <a href="earth-impact.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('earth-impact') ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="globe-2" class="w-4 h-4 text-emerald-400"></i>
                  <span x-text="$store.app.kids ? 'Storm vs Earth' : 'Solar Storm vs Earth'"></span>
                </a>
              </div>
            </div>

            <div>
              <p class="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 mb-1.5">Physics & Materials</p>
              <div class="space-y-1">
                <a href="material-ranker.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('material-ranker') ? 'bg-purple-500/15 text-purple-400 font-semibold border border-purple-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="layers" class="w-4 h-4 text-purple-400"></i>
                  <span x-text="$store.app.kids ? 'Burn Race' : 'Material Ranker'"></span>
                </a>
                <a href="gravity-gap.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('gravity-gap') ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="orbit" class="w-4 h-4 text-sky-400"></i>
                  <span x-text="$store.app.kids ? 'Gravity Guess' : 'Gravity Gap-Filler'"></span>
                </a>
                <a href="flame-radar.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('flame-radar') ? 'bg-indigo-500/15 text-indigo-400 font-semibold border border-indigo-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="radar" class="w-4 h-4 text-indigo-400"></i>
                  <span x-text="$store.app.kids ? 'Ghost Flames' : 'Invisible Flame Radar'"></span>
                </a>
              </div>
            </div>

            <div>
              <p class="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 mb-1.5">Intelligence & Data</p>
              <div class="space-y-1">
                <a href="fire-gpt.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('fire-gpt') ? 'bg-pink-500/15 text-pink-400 font-semibold border border-pink-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="message-square-text" class="w-4 h-4 text-pink-400"></i>
                  <span x-text="$store.app.kids ? 'Quiz Time' : 'FireGPT AI'"></span>
                </a>
                <a href="gap-map.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('gap-map') ? 'bg-yellow-500/15 text-yellow-400 font-semibold border border-yellow-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="map" class="w-4 h-4 text-yellow-400"></i>
                  <span x-text="$store.app.kids ? 'Plan Tests' : 'Research Gap Map'"></span>
                </a>
                <a href="sources.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('sources') ? 'bg-blue-500/15 text-blue-400 font-semibold border border-blue-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="database" class="w-4 h-4 text-blue-400"></i>
                  <span x-text="$store.app.kids ? 'Space Cards' : 'Data Sources'"></span>
                </a>
                <a href="api-docs.html" class="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isPage('api-docs') ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'}">
                  <i data-lucide="code-2" class="w-4 h-4 text-cyan-400"></i>
                  <span>API & Data Explorer</span>
                </a>
              </div>
            </div>
          </nav>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>NASA Space Apps 2026</span>
          <span class="mono">v2.0 Mobile</span>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  // 2. Mobile Bottom Dock
  if (!document.getElementById('mobile-bottom-dock')) {
    const dock = document.createElement('nav');
    dock.id = 'mobile-bottom-dock';
    dock.className = 'mobile-bottom-dock md:hidden';
    dock.innerHTML = `
      <a href="index.html" class="mobile-dock-btn ${isPage('index') ? 'active' : ''}">
        <i data-lucide="gauge"></i>
        <span>Overview</span>
      </a>
      <a href="flame-lab.html" class="mobile-dock-btn ${isPage('flame-lab') ? 'active' : ''}">
        <i data-lucide="flask-conical"></i>
        <span>Lab 3D</span>
      </a>
      <a href="space-craft.html" class="mobile-dock-btn ${isPage('space-craft') ? 'active' : ''}">
        <i data-lucide="rocket"></i>
        <span>Sim</span>
      </a>
      <a href="solar-watch.html" class="mobile-dock-btn ${isPage('solar-watch') ? 'active' : ''}">
        <i data-lucide="sun"></i>
        <span>Solar</span>
      </a>
      <button type="button" @click="window.unifiedAssistant ? window.unifiedAssistant.open() : ($store.app.openAssistant && $store.app.openAssistant())" class="mobile-dock-btn ${isPage('fire-gpt') ? 'active' : ''}">
        <i data-lucide="sparkles"></i>
        <span>Aura AI</span>
      </button>
      <button type="button" @click="$store.app.toggleMobileMenu()" class="mobile-dock-btn">
        <i data-lucide="menu"></i>
        <span>More</span>
      </button>
    `;
    document.body.appendChild(dock);
  }

  // 3. Inject Mobile Header Trigger
  const header = document.querySelector('header');
  if (header && !document.getElementById('mobile-menu-btn')) {
    const btn = document.createElement('button');
    btn.id = 'mobile-menu-btn';
    btn.setAttribute('@click', '$store.app.toggleMobileMenu()');
    btn.className = 'md:hidden glass-pill px-2.5 py-1.5 text-slate-200 hover:text-white shrink-0 mr-2 flex items-center gap-1.5';
    btn.innerHTML = `
      <div class="w-5 h-5 rounded-md bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center">
        <i data-lucide="flame" class="w-3 h-3 text-white"></i>
      </div>
      <span class="text-xs font-bold text-white tracking-tight">FlameAtlas</span>
      <i data-lucide="menu" class="w-3.5 h-3.5 text-slate-400 ml-0.5"></i>
    `;
    header.insertBefore(btn, header.firstChild);
  }
}
