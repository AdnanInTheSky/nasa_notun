# FlameAtlas — Rebuilt Frontend (CDN Edition)

Rebuilt version of **FlameAtlas** (NASA Space Apps 2026: *Flame in Freefall*) using pure HTML, Tailwind CSS CDN, Alpine.js CDN, Three.js CDN, GSAP CDN, Chart.js CDN, and Canvas Confetti CDN.

All rebuilt assets reside in the `old/` directory.

---

## Architecture Overview

### 1. Separate Pages for Each Section
Every dashboard section has its own dedicated page with deep interactivity, 3D simulations, and mini-games:

- [`index.html`](file:///C:/Users/victus/Documents/nasa_2026/old/index.html) — **Mission Overview**: Dynamic cabin fire risk gauge, key environmental metrics (gravity, oxygen, cabin pressure, comms delay), risk across phases bar chart, and the interactive **Mission Journey Map** game.
- [`flame-lab.html`](file:///C:/Users/victus/Documents/nasa_2026/old/flame-lab.html) — **Flame Lab 3D**: Full 3D combustion simulator running Three.js with custom GLSL flame shaders (teardrop to 0g blue ball), O₂ and soot particle drift, extinguisher CO₂ spray, ceiling smoke alarm, hidden cool flames with infrared heat vision, and 6 guided lesson stages.
- [`space-craft.html`](file:///C:/Users/victus/Documents/nasa_2026/old/space-craft.html) — **Spacecraft Fire & Solar EMP Simulator**: Complete interactive 3D modular spacecraft (*NSS Prometheus*) with rotating centrifuge ring ($1.0g$), 6 compartmentalized modules, fire spread & material reaction kinetics (Kapton, Li-Ion thermal runaway, Nomex, PMMA, Delrin), primary 120V vs rad-hardened 28V backup electronics with auto-failover, solar flare CME shockwave & EMP semiconductor blowout, section abandonment & vacuum purge protocols, centrifuge mass unbalance wobble & nutation, planetary/lunar orbital gravity pull, and the **AURA Flight AI** emergency chatbot assistant.
- [`solar-watch.html`](file:///C:/Users/victus/Documents/nasa_2026/old/solar-watch.html) — **Solar Flare Watch**: Real space-weather flares from NASA's DONKI API with a 3D animated Sun, active magnetic loop flash, X-ray wave, Parker spiral proton storm, CME cloud, 30-day timeline chart, and the **Storm Shelter** flight director game.
- [`earth-impact.html`](file:///C:/Users/victus/Documents/nasa_2026/old/earth-impact.html) — **Solar Storm vs Earth**: 3D procedural Earth simulator with squashed dayside magnetopause (Shue model), equatorward shifting auroral oval with Kp, satellite orbits (ISS, GPS, GEO), NOAA R/S/G scale readouts, and historic storm presets (Carrington 1859, May 2024 Gannon, etc.).
- [`material-ranker.html`](file:///C:/Users/victus/Documents/nasa_2026/old/material-ranker.html) — **Material Risk Ranker**: Sortable table ranking cabin materials by predicted flammability under active mission conditions, SHAP explainability feature impact bars, and the head-to-head 3D **Burn Race** bench game.
- [`gravity-gap.html`](file:///C:/Users/victus/Documents/nasa_2026/old/gravity-gap.html) — **Gravity Gap-Filler**: Gaussian Process regression curve across gravity levels (0g to 1g) with 95% uncertainty band, observed NASA BASS test points, and the **Gravity Guess** prediction game.
- [`flame-radar.html`](file:///C:/Users/victus/Documents/nasa_2026/old/flame-radar.html) — **Invisible Flame Radar**: 2D regime classifier matrix (hot, cool, extinct) over O₂ × Pressure, current cabin atmosphere marker, and the fogged **Ghost Flame Hunter** radar search game.
- [`fire-gpt.html`](file:///C:/Users/victus/Documents/nasa_2026/old/fire-gpt.html) — **FireGPT AI & Quiz**: Conversational retrieval assistant citing NASA PSI & NTRS papers, suggested prompts, and the 7-question **FireGPT Quiz** with streak combo bonuses.
- [`gap-map.html`](file:///C:/Users/victus/Documents/nasa_2026/old/gap-map.html) — **Research Gap Map**: Test coverage heatmap showing tested experiments versus untested zones, ranked recommendations of what NASA should test next, and the **Gap Planner** budget allocation game.
- [`sources.html`](file:///C:/Users/victus/Documents/nasa_2026/old/sources.html) — **Data Sources & Space Cards**: 3D flipping collectible science cards linking to the NASA PSI repository and NTRS publications that unlock as badges are earned.

---

### 2. Frontend Real API (`js-api/`)
- [`js-api/donki-api.js`](file:///C:/Users/victus/Documents/nasa_2026/old/js-api/donki-api.js) — Queries live NASA DONKI FLR API (`https://api.nasa.gov/DONKI/FLR`) and CCMC mirror directly on the client, normalizes flares, computes mission risk, decays right-now risk, and gracefully falls back to `data/donki-snapshot.json` when offline.

---

### 3. Dummy Data JSON Files (`data/`)
All section data is externalized into clean JSON files:
- [`data/missions.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/missions.json) — Mission phases (ISS, Gateway, Moon, Mars Transit, Mars Surface)
- [`data/materials.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/materials.json) — Cabin materials, LOI, flammability baselines
- [`data/gravity.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/gravity.json) — Presets and GP parameters
- [`data/radar.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/radar.json) — Fuels, diluents, O₂ & pressure axes
- [`data/firegpt.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/firegpt.json) — Question knowledge base & citations
- [`data/gaps.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/gaps.json) — Gap grid axes & test-next rankings
- [`data/sources.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/sources.json) — NASA Open Science sources
- [`data/game.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/game.json) — Levels, badges, missions, trivia quiz
- [`data/lab.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/lab.json) — Lab materials, places, lessons
- [`data/earth-presets.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/earth-presets.json) — Storm scenarios and cities
- [`data/donki-snapshot.json`](file:///C:/Users/victus/Documents/nasa_2026/old/data/donki-snapshot.json) — Offline backup of real DONKI flares

---

### 4. Script Loading & Alpine.js Lifecycle
To prevent race conditions where Alpine evaluates expressions before components and stores are initialized:
- Core scripts (`js/models.js`, `js/shared.js`, and any 3D/API modules) are loaded in `<head>` as standard synchronous scripts that expose their APIs directly to `window`.
- Global Alpine store (`$store.app`) contains instant fallback defaults so properties (`$store.app.phases`, `$store.app.kids`, `$store.app.xp`, etc.) are always immediately defined on the initial render pass.
- Page components (e.g. `overviewPage()`, `flameLabPage()`, etc.) are defined in `<script>` tags before Alpine initializes, and registered with both `window` and `Alpine.data()`.
- The Alpine.js CDN script is deferred at the bottom of the HTML page, guaranteeing that all stores, components, and DOM elements are registered in memory before Alpine starts DOM traversal.

---

### 5. Running the Dashboard
Serve the `old/` directory using any local web server:

```bash
# Python
python -m http.server 8000 --directory old

# Or Node.js
npx serve old
```
Open `http://localhost:8000` in your browser.
