# Sources & Citations

This document provides complete provenance, citations, documentation links, and operational purposes for all external APIs and static JSON datasets used throughout **FlameAtlas** (NASA Space Apps 2026: *Flame in Freefall*).

---

## APIs

### NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)
- **Source:** NASA Goddard Space Flight Center (GSFC) / Community Coordinated Modeling Center (CCMC)
- **API:** `https://api.nasa.gov/DONKI/FLR` (Solar Flares API) & CCMC mirror `https://kauai.ccmc.gsfc.nasa.gov/DONKI/`
- **Documentation:** [NASA DONKI Documentation](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) | [NASA Open APIs Portal](https://api.nasa.gov/)
- **Serverless Integration:** Handled via `/api/donki` serverless endpoint (`api/donki.js`) with server-side caching and fallback.
- **Purpose:** Supplies real-time and historical space-weather telemetry (soft X-ray flux, solar flare classifications A/B/C/M/X, coronal mass ejections [CMEs], solar energetic particle [SEP] events, source active region coordinates, and Parker spiral transport). Used across the *Solar Flare Watch*, *Solar Storm vs Earth*, and *Spacecraft Simulation* modules to compute radiation hazard, avionics single-event upset (SEU) probabilities, and dayside magnetopause standoff distance ($R_{mp}$).

### OpenAI API
- **Source:** OpenAI
- **API:** `https://api.openai.com/v1/chat/completions` (Chat Completions API with `gpt-4o-mini`)
- **Documentation:** [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat)
- **Serverless Integration:** Handled via `/api/openai` serverless endpoint (`api/openai.js`). The API key is securely accessed via the server-side `OPENAI_API_KEY` environment variable and is never exposed in client-side code.
- **Purpose:** Serves as the conversational fallback engine for the Unified Assistant (FireGPT + Aura). Invoked only when the Common Intents System (`/data/intents.json`) lacks a direct answer to an inquiry, providing natural-language scientific explanations citing NASA physical science and ECLSS flight standards.

---

## JSON Data

### Common Intents & Unified Knowledge Base
- **File used:** `/data/intents.json`
- **Source:** Manually created and structured by the FlameAtlas project team, synthesizing verified experimental findings from NASA Physical Sciences Informatics (PSI), NASA Technical Reports Server (NTRS), and NASA Flight Rules.
- **Original URLs:**
  - [NASA Physical Sciences Informatics (PSI)](https://psi.ndc.nasa.gov/)
  - [NASA Technical Reports Server (NTRS)](https://ntrs.nasa.gov/)
  - [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/)
- **Purpose:** Acts as the primary **first source of truth** for the Unified Assistant. Contains predefined intent matches, suggested questions, tactical emergency response procedures, and page-by-page explanatory text across all 12 platform views.

### FireGPT NASA Research Citations
- **File used:** `/data/firegpt.json`
- **Source:** Derived from indexed NASA PSI flight experiments and peer-reviewed NTRS technical reports.
- **Original URLs:**
  - [BASS Experiment (PSI-26)](https://psi.ndc.nasa.gov/)
  - [FLEX Experiment (PSI-69)](https://psi.ndc.nasa.gov/)
  - [DAFT / DAFT-2 Smoke Sensor Investigation (PSI-47)](https://psi.ndc.nasa.gov/)
  - [ACME CFI-G Cool Flames Investigation (PSI-159)](https://psi.ndc.nasa.gov/)
  - [FLEX Detailed Test Results (NTRS 20150023456)](https://ntrs.nasa.gov/citations/20150023456)
  - [Spacecraft Smoke Detection Studies (NTRS 20130000422)](https://ntrs.nasa.gov/citations/20130000422)
- **Purpose:** Ground-truth scientific dataset for FireGPT question answering covering Nomex flammability in oxygen-rich environments, low-temperature cool-flame chemistry, microgravity smoke particle agglomeration, and suppressant gas concentrations.

### NASA DONKI Solar Flare Snapshot
- **File used:** `/data/donki-snapshot.json`
- **Source:** NASA DONKI (Database of Notifications, Knowledge, Information) space-weather log for Solar Cycle 25 (August–September 2026 snapshot).
- **Original URL:** [NASA DONKI Catalog](https://kauai.ccmc.gsfc.nasa.gov/DONKI/)
- **Purpose:** Provides a guaranteed zero-latency, offline-safe fallback catalog of 17 verified solar flare events, linked CME IDs, flare class types, and active solar regions when live network queries are unavailable.

### Spacecraft Materials & Flammability Limits
- **File used:** `/data/materials.json`
- **Source:** NASA Technical Standard NASA-STD-6001B (*Flammability, Odor, Offgassing, and Compatibility Requirements and Test Procedures for Materials in Environments that Support Combustion*) and NASA BASS (PSI-26) / Saffire flight research data.
- **Original URL:** [NASA Technical Standards System](https://standards.nasa.gov/standard/nasa/nasa-std-6001)
- **Purpose:** Defines physical flammability baselines, Limiting Oxygen Index (LOI %), material polymer classifications, and relative flame spread rates for 10 space-grade materials (Nomex, Kapton, PMMA, Cotton, Teflon/PTFE, Silicone, Nylon, Delrin, Ultem, and Polyethylene).

### Spaceflight Exploration Atmospheres & Missions
- **File used:** `/data/missions.json`
- **Source:** NASA SP-2010-3407 (*Exploration Atmospheres: Recommended Values for Habitable Spacecraft*) and NASA SP-2016-ECLSS specifications.
- **Original URL:** [NASA Exploration Atmospheres Documentation](https://www.nasa.gov/exploration-atmospheres)
- **Purpose:** Outlines target baseline habitat parameters across five exploration mission profiles: International Space Station (14.7 psi, 21% O₂, 0g), Lunar Gateway (10.2 psi, 26.5% O₂, 0g), Artemis Moon Surface (8.2 psi, 34% O₂, 0.16g), Deep Space Mars Transit (10.2 psi, 26.5% O₂, 0g), and Mars Surface Habitat (8.2 psi, 34% O₂, 0.38g).

### Gaussian Process Gravity Hyperparameters
- **File used:** `/data/gravity.json`
- **Source:** Created by the FlameAtlas project team; mathematical formulation applies Gaussian Process (GP) regression with Radial Basis Function (RBF) covariance kernels to interpolate between empirical 0g flight points (ISS BASS) and 1g terrestrial drop-tower points.
- **Original URL:** [NASA Physical Sciences Informatics](https://psi.ndc.nasa.gov/)
- **Purpose:** Encodes gravity steps, orbital gravity presets (0g, 0.16g, 0.38g, 1.0g), and model description highlighting the 95% uncertainty band where physical microgravity solid-combustion tests are absent.

### Invisible Flame Combustion Regime Matrix
- **File used:** `/data/radar.json`
- **Source:** Synthesized from NASA FLEX (PSI-69), FLEX-2 (PSI-68), and ACME CFI-G (PSI-159) experimental boundary datasets.
- **Original URL:** [NASA Physical Sciences Informatics](https://psi.ndc.nasa.gov/)
- **Purpose:** Defines chemical fuels (n-Heptane, n-Decane, n-Dodecane, Methanol), inert diluents (N₂, CO₂, He), and coordinate axes for oxygen fraction (10% to 40%) and atmospheric pressure (0.5 to 3.0 atm) used in the 2D regime classifier and Ghost Flame Hunter game.

### Microgravity Research Gap Priorities
- **File used:** `/data/gaps.json`
- **Source:** Formulated by the FlameAtlas project team based on gap analyses of the NASA Physical Sciences Informatics (PSI) repository and the National Academies Biological and Physical Sciences in Space Decadal Survey.
- **Original URL:** [NASA PSI Repository](https://psi.ndc.nasa.gov/)
- **Purpose:** Maps out tested vs untested operational envelopes across oxygen concentration and planetary gravity, providing ranked recommendations for NASA's next testing priorities (e.g., solid-material combustion under lunar 0.16g at 34% O₂).

### Flame Lab 3D Chamber Presets & Lessons
- **File used:** `/data/lab.json`
- **Source:** Educational curriculum and 3D simulation parameters designed by the FlameAtlas project team, drawing scientific context from the NASA Glenn Research Center 2.2-Second Drop Tower and Zero Gravity Research Facility.
- **Original URL:** [NASA Glenn Zero Gravity Research Facility](https://www1.grc.nasa.gov/facilities/zero-g/)
- **Purpose:** Configures 3D combustion chamber environments (Earth, Orbit, Moon, Mars), material combustibility factors, and the 6 guided interactive lessons covering the fire triangle, buoyancy, soot formation, and infrared heat vision.

### Historical Geomagnetic Storm Presets
- **File used:** `/data/earth-presets.json`
- **Source:** NOAA Space Weather Prediction Center (SWPC) Historical Storm Archive and USGS Geomagnetism Program records.
- **Original URL:** [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/)
- **Purpose:** Provides historical storm metrics (solar wind velocity, IMF $B_z$ magnetic vector, proton density, Dst index) for benchmark space-weather events: Carrington Event (1859), Halloween Storms (2003), and the Gannon Storm (May 2024), along with global city coordinates for auroral visibility calculations.

### Gamification Milestones, Badges & Quiz
- **File used:** `/data/game.json`
- **Source:** Gamification architecture designed by the FlameAtlas project team. Trivia questions, distractors, explanations, and citations are verified against official NASA NTRS flight reports.
- **Original URL:** [NASA Technical Reports Server](https://ntrs.nasa.gov/)
- **Purpose:** Defines Space Cadet XP progression levels (Cadet through Mission Fire Chief), unlockable achievement badges, and the 7-question microgravity science quiz with streak bonus logic.

### Master Citation Catalog
- **File used:** `/data/sources.json`
- **Source:** Curated direct catalog of official NASA Physical Sciences Informatics (PSI), NTRS publications, and GSFC DONKI services.
- **Original URLs:**
  - [NASA Physical Sciences Informatics (PSI)](https://psi.ndc.nasa.gov/)
  - [NASA Technical Reports Server (NTRS)](https://ntrs.nasa.gov/)
  - [NASA Goddard CCMC DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/)
- **Purpose:** Supplies data for the collectible 3D Space Cards and direct links to public NASA open science publications.

### OpenAPI Specification
- **File used:** `/data/openapi.json`
- **Source:** Created by the FlameAtlas project team in compliance with the OpenAPI 3.0.3 standard.
- **Original URL:** [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- **Purpose:** Drives the interactive Swagger UI testing console on `/api-docs.html` for inspecting and executing live calls against `/api/donki`, `/api/openai`, and `/api/intents`.
