/**
 * Spacecraft Fire, Material, Gravity, Electronics & Orbital Physics Simulation Engine
 * FlameAtlas — Spacecraft Safety Module
 * Based on NASA BASS, FLEX, Saffire-I~VI, and orbital mechanics.
 */

(function (window) {
  'use strict';

  // Constants
  const G_CONST = 6.6743e-11; // Gravitational constant
  const EARTH_MASS = 5.972e24; // kg
  const EARTH_RADIUS = 6.371e6; // m
  const MOON_MASS = 7.342e22; // kg
  const MOON_ORBIT_DIST = 384400e3; // m
  const MARS_MASS = 6.417e23; // kg
  const MARS_RADIUS = 3.3895e6; // m

  // Material Library with Combustion & Pyrolysis Kinetics
  const MATERIAL_DATABASE = {
    kapton: {
      id: 'kapton',
      name: 'Kapton Polyimide',
      category: 'Avionics Wire Insulation',
      loi: 37.0, // Critical Oxygen Index (%)
      pyrolysisTemp: 520, // °C
      ignitionTemp: 560, // °C
      hrrPeak: 185, // Peak Heat Release Rate (kW/m²)
      heatOfCombustion: 24.2, // MJ/kg
      charFraction: 0.55,
      toxicGas: 'CO (high), HCN (moderate), Smoke',
      description: 'Used in electrical wire bundles. Emits toxic hydrogen cyanide when pyrolyzing; high LOI resists Earth air but burns in enriched O₂.'
    },
    li_ion: {
      id: 'li_ion',
      name: 'Lithium-Ion NMC 21700',
      category: 'Energy Storage Cells',
      loi: 0.0, // Self-oxidizing! Burns in 0% O2 / vacuum!
      pyrolysisTemp: 160, // Thermal runaway threshold °C
      ignitionTemp: 195, // °C
      hrrPeak: 850, // Extreme Heat Release Rate (kW/m²)
      heatOfCombustion: 38.5, // MJ/kg equivalent
      charFraction: 0.15,
      toxicGas: 'HF (lethal), H2 (explosive), CO, CH4',
      description: 'Cathode decomposition releases atomic oxygen. Self-sustaining thermal runaway CANNOT be suffocated by vacuum or CO₂ alone; requires aggressive cooling.'
    },
    nomex: {
      id: 'nomex',
      name: 'Nomex HT90-40',
      category: 'Bulkhead & Acoustic Panel',
      loi: 28.5, // LOI %
      pyrolysisTemp: 440,
      ignitionTemp: 490,
      hrrPeak: 120,
      heatOfCombustion: 19.8,
      charFraction: 0.65,
      toxicGas: 'CO, CO2, moderate smoke',
      description: 'Flame-resistant aramid. Forms an insulating char barrier. Self-extinguishes in standard ISS air but burns under partial gravity with enriched O₂.'
    },
    delrin: {
      id: 'delrin',
      name: 'Delrin (Polyoxymethylene)',
      category: 'Structural Brackets & Gears',
      loi: 15.0, // Very low LOI
      pyrolysisTemp: 220,
      ignitionTemp: 320,
      hrrPeak: 450,
      heatOfCombustion: 22.0,
      charFraction: 0.05,
      toxicGas: 'Formaldehyde (toxic), CO',
      description: 'Highly flammable engineering thermoplastic. Burns with almost no visible soot and leaves virtually zero protective char.'
    },
    pmma: {
      id: 'pmma',
      name: 'PMMA (Acrylic Glass)',
      category: 'Cupola Observation Windows',
      loi: 17.3,
      pyrolysisTemp: 280,
      ignitionTemp: 390,
      hrrPeak: 560,
      heatOfCombustion: 26.5,
      charFraction: 0.02,
      toxicGas: 'Methyl methacrylate vapor, CO',
      description: 'Melts and drips burning droplets. Generates severe pool fire dynamics in gravity, or spherical glowing bubbles in microgravity.'
    },
    ptfe: {
      id: 'ptfe',
      name: 'PTFE (Teflon)',
      category: 'Fluid Lines & Valve Seals',
      loi: 95.0, // Ultra fire-resistant
      pyrolysisTemp: 480,
      ignitionTemp: 650,
      hrrPeak: 65,
      heatOfCombustion: 5.1,
      charFraction: 0.85,
      toxicGas: 'Fluorocarbon fumes, HF (toxic polymer fever)',
      description: 'Virtually non-flammable in standard spacecraft atmospheres. Emits toxic fluoropolymer fumes when heated above 400°C.'
    }
  };

  // Spacecraft Simulation Class
  class SpacecraftSimulation {
    constructor() {
      // Spacecraft Base Specifications
      this.name = 'NSS Prometheus (Deep Space Cruiser)';
      this.totalMassBase = 63100; // kg base dry mass
      this.length = 32.0; // meters total length
      this.centrifugeRadius = 14.0; // meters radius of rotating habitat ring
      this.centrifugeRpm = 8.0; // RPM -> ~1.0 g at rim
      this.spinEnabled = true;

      // Celestial & Orbital Configuration
      this.orbitalBody = 'earth'; // 'earth' or 'mars'
      this.orbitalAltitude = 420000; // 420 km LEO (ISS orbit)
      this.orbitalVelocity = 7660; // m/s
      this.orbitalDecayRate = 0; // m/s altitude loss
      this.orbitalDecayRisk = false;
      this.orbitTimeRemaining = null; // seconds until atmospheric skip/decay

      // Solar & Space Weather Status
      this.solarActivity = 'quiet'; // 'quiet', 'active', 'flare_c', 'flare_m', 'flare_x', 'carrington'
      this.flareActive = false;
      this.flareIntensity = 0; // 0 to 100
      this.flareClass = 'None';
      this.cmeArrivalTime = 0;
      this.shieldStrength = 85; // % deflector shield rating

      // Spacecraft Compartments / Sections
      this.sections = {
        bridge: {
          id: 'bridge',
          name: 'Command Bridge & Astrogation',
          code: 'SEC-A',
          volume: 65, // m³
          baseMass: 4200, // kg
          fuelMass: 180, // kg combustible materials
          materialId: 'pmma',
          temperature: 22.0, // °C
          pressure: 101.3, // kPa
          o2: 21.0, // %
          co_ppm: 5,
          smokeDensity: 0.02, // OD/m
          burning: false,
          coolFlame: false,
          fireSize: 0, // 0.0 to 1.0
          heatReleaseRate: 0, // kW
          charFraction: 0,
          abandoned: false,
          vented: false,
          doorsSealed: false,
          suppressantFlooded: false,
          crewPresent: 2,
          neighbors: ['centrifuge', 'science'],
          // Electronics Subsystem
          electronics: {
            primary: {
              name: 'Primary Flight Computer (PFC-1)',
              bus: '120V Main DC',
              voltage: 120.0,
              nominalVoltage: 120.0,
              current: 14.2, // A
              temp: 34.0, // °C
              shieldingDb: 48,
              health: 100, // %
              status: 'NOMINAL', // NOMINAL, OVERHEATING, DEGRADED, FRIED
              online: true
            },
            backup: {
              name: 'Emergency Astrogation Core (EAC-2)',
              bus: '28V Rad-Hardened DC',
              voltage: 28.0,
              nominalVoltage: 28.0,
              current: 3.8,
              temp: 26.0,
              shieldingDb: 72,
              health: 100,
              status: 'STANDBY', // STANDBY, ACTIVE, DEGRADED, FRIED
              online: true,
              autoFailover: true
            }
          }
        },
        centrifuge: {
          id: 'centrifuge',
          name: 'Habitation Centrifuge Ring',
          code: 'SEC-B',
          volume: 280,
          baseMass: 16500,
          fuelMass: 650,
          materialId: 'nomex',
          temperature: 21.5,
          pressure: 101.3,
          o2: 21.5,
          co_ppm: 8,
          smokeDensity: 0.01,
          burning: false,
          coolFlame: false,
          fireSize: 0,
          heatReleaseRate: 0,
          charFraction: 0,
          abandoned: false,
          vented: false,
          doorsSealed: false,
          suppressantFlooded: false,
          crewPresent: 4,
          neighbors: ['bridge', 'science'],
          // Rotating ring specific:
          isCentrifuge: true,
          ringMassOffset: 0, // dynamic unbalance in kg
          wobbleAngle: 0, // degrees precession
          electronics: {
            primary: {
              name: 'Centrifuge Drive & Hub Gyro (CDH-1)',
              bus: '120V Main DC',
              voltage: 120.0,
              nominalVoltage: 120.0,
              current: 32.5,
              temp: 42.0,
              shieldingDb: 40,
              health: 100,
              status: 'NOMINAL',
              online: true
            },
            backup: {
              name: 'Secondary Counter-Torque Driver (CTD-2)',
              bus: '28V Rad-Hardened DC',
              voltage: 28.0,
              nominalVoltage: 28.0,
              current: 11.4,
              temp: 31.0,
              shieldingDb: 68,
              health: 100,
              status: 'STANDBY',
              online: true,
              autoFailover: true
            }
          }
        },
        science: {
          id: 'science',
          name: 'Science Lab & ECLSS',
          code: 'SEC-C',
          volume: 95,
          baseMass: 7800,
          fuelMass: 320,
          materialId: 'delrin',
          temperature: 20.0,
          pressure: 82.7, // Gateway 8.2 psi baseline
          o2: 24.5, // Enriched oxygen atmosphere!
          co_ppm: 6,
          smokeDensity: 0.01,
          burning: false,
          coolFlame: false,
          fireSize: 0,
          heatReleaseRate: 0,
          charFraction: 0,
          abandoned: false,
          vented: false,
          doorsSealed: false,
          suppressantFlooded: false,
          crewPresent: 1,
          neighbors: ['bridge', 'centrifuge', 'avionics'],
          electronics: {
            primary: {
              name: 'ECLSS Atmospheric Scrubber (ARS-1)',
              bus: '120V Main DC',
              voltage: 120.0,
              nominalVoltage: 120.0,
              current: 18.0,
              temp: 36.0,
              shieldingDb: 42,
              health: 100,
              status: 'NOMINAL',
              online: true
            },
            backup: {
              name: 'Auxiliary Life Support Logic (ALS-2)',
              bus: '28V Rad-Hardened DC',
              voltage: 28.0,
              nominalVoltage: 28.0,
              current: 5.5,
              temp: 28.0,
              shieldingDb: 70,
              health: 100,
              status: 'STANDBY',
              online: true,
              autoFailover: true
            }
          }
        },
        avionics: {
          id: 'avionics',
          name: 'Avionics Bay & DSN Comms',
          code: 'SEC-D',
          volume: 45,
          baseMass: 3900,
          fuelMass: 140,
          materialId: 'kapton',
          temperature: 24.0,
          pressure: 101.3,
          o2: 20.9,
          co_ppm: 4,
          smokeDensity: 0.01,
          burning: false,
          coolFlame: false,
          fireSize: 0,
          heatReleaseRate: 0,
          charFraction: 0,
          abandoned: false,
          vented: false,
          doorsSealed: false,
          suppressantFlooded: false,
          crewPresent: 0,
          neighbors: ['science', 'reactor'],
          electronics: {
            primary: {
              name: 'Main Bus PDU & DSN Transceiver (PDU-1)',
              bus: '120V Main DC',
              voltage: 120.0,
              nominalVoltage: 120.0,
              current: 28.4,
              temp: 45.0,
              shieldingDb: 55,
              health: 100,
              status: 'NOMINAL',
              online: true
            },
            backup: {
              name: 'Safe-Mode Optic Hub & DSN Backup (SMH-2)',
              bus: '28V Rad-Hardened DC',
              voltage: 28.0,
              nominalVoltage: 28.0,
              current: 6.2,
              temp: 29.0,
              shieldingDb: 78,
              health: 100,
              status: 'STANDBY',
              online: true,
              autoFailover: true
            }
          }
        },
        reactor: {
          id: 'reactor',
          name: 'Power Core & Battery Vault',
          code: 'SEC-E',
          volume: 70,
          baseMass: 12200,
          fuelMass: 450,
          materialId: 'li_ion', // High thermal runaway risk!
          temperature: 32.0,
          pressure: 90.0,
          o2: 17.5, // Inerted nitrogen rich
          co_ppm: 12,
          smokeDensity: 0.03,
          burning: false,
          coolFlame: false,
          fireSize: 0,
          heatReleaseRate: 0,
          charFraction: 0,
          abandoned: false,
          vented: false,
          doorsSealed: false,
          suppressantFlooded: false,
          crewPresent: 0,
          neighbors: ['avionics', 'propulsion'],
          electronics: {
            primary: {
              name: 'Reactor Magnetic Shunt & BMS (BMS-1)',
              bus: '120V Main DC',
              voltage: 120.0,
              nominalVoltage: 120.0,
              current: 44.0,
              temp: 48.0,
              shieldingDb: 62,
              health: 100,
              status: 'NOMINAL',
              online: true
            },
            backup: {
              name: 'Emergency Pyro Shunt Logic (EPS-2)',
              bus: '28V Rad-Hardened DC',
              voltage: 28.0,
              nominalVoltage: 28.0,
              current: 7.5,
              temp: 33.0,
              shieldingDb: 80,
              health: 100,
              status: 'STANDBY',
              online: true,
              autoFailover: true
            }
          }
        },
        propulsion: {
          id: 'propulsion',
          name: 'Cargo Bay & Ion Propulsion',
          code: 'SEC-F',
          volume: 160,
          baseMass: 18500,
          fuelMass: 380,
          materialId: 'ptfe',
          temperature: 15.0,
          pressure: 101.3,
          o2: 20.2,
          co_ppm: 5,
          smokeDensity: 0.01,
          burning: false,
          coolFlame: false,
          fireSize: 0,
          heatReleaseRate: 0,
          charFraction: 0,
          abandoned: false,
          vented: false,
          doorsSealed: false,
          suppressantFlooded: false,
          crewPresent: 0,
          neighbors: ['reactor'],
          electronics: {
            primary: {
              name: 'Ion Grid & RCS Vector Controller (IVC-1)',
              bus: '120V Main DC',
              voltage: 120.0,
              nominalVoltage: 120.0,
              current: 36.0,
              temp: 38.0,
              shieldingDb: 42,
              health: 100,
              status: 'NOMINAL',
              online: true
            },
            backup: {
              name: 'Cold-Gas RCS Pneumatic Override (RCS-2)',
              bus: '28V Rad-Hardened DC',
              voltage: 28.0,
              nominalVoltage: 28.0,
              current: 5.0,
              temp: 22.0,
              shieldingDb: 74,
              health: 100,
              status: 'STANDBY',
              online: true,
              autoFailover: true
            }
          }
        }
      };

      // Gravity Calculations & Metrics
      this.gravityMetrics = {
        artificialG: 1.0, // Centrifugal g at rim
        effectiveG: 1.0, // Active local g
        planetaryG: 8.68, // External planetary gravitational acceleration (m/s²)
        lunarG: 0.00003, // Moon tidal pull (m/s²)
        netOrbitalG: 0.0, // Freefall residual micro-g (10^-6 g)
        centerOfMassShift: 0.0, // meters offset from geometric axis
        bearingStress: 12.0, // % mechanical stress on centrifuge ring
        wobbleRms: 0.02, // deg/s nutation
        flameRegime: 'buoyant' // 'buoyant', 'micro_ball', 'cool_diffusive', 'extinct'
      };

      // Event Logs & Chatbot Emergency Queue
      this.eventLogs = [];
      this.alerts = [];
      this.time = 0; // seconds
      this.stepDt = 0.5; // step size in seconds

      this.logEvent('System initialized. All 6 compartments nominal. Centrifuge ring rotating at 8.0 RPM (1.0g).');
    }

    logEvent(text, level = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      this.eventLogs.unshift({ timestamp, text, level });
      if (this.eventLogs.length > 50) this.eventLogs.pop();
    }

    addAlert(title, message, level = 'warning', sectionId = null) {
      const id = Date.now() + Math.random();
      const alert = { id, title, message, level, sectionId, timestamp: new Date().toLocaleTimeString() };
      this.alerts.unshift(alert);
      if (this.alerts.length > 10) this.alerts.pop();
      return alert;
    }

    clearAlert(id) {
      this.alerts = this.alerts.filter((a) => a.id !== id);
    }

    // -------------------------------------------------------------
    // Gravity Physics Engine: Artificial Spin + External Planetary
    // -------------------------------------------------------------
    updateGravityPhysics(dt) {
      const secB = this.sections.centrifuge;
      const secE = this.sections.reactor;

      // 1. Artificial Centrifuge Gravity Calculation
      // If the spin motor electronics (both primary & backup) are fried, or if centrifuge is abandoned:
      const pB = secB.electronics.primary;
      const bB = secB.electronics.backup;
      const motorOperational = (pB.health > 0 && pB.online) || (bB.health > 0 && bB.online && bB.status === 'ACTIVE');

      if (!this.spinEnabled || !motorOperational || secB.abandoned) {
        // Spin decay due to bearing friction & power loss
        if (this.centrifugeRpm > 0.05) {
          this.centrifugeRpm = Math.max(0, this.centrifugeRpm - 0.25 * dt);
          if (this.centrifugeRpm === 0) {
            this.logEvent('Habitation centrifuge has completely stopped spinning. Zero gravity established throughout ship.', 'warning');
          }
        }
      } else {
        // Target 8.0 RPM for nominal 1.0g
        if (this.centrifugeRpm < 8.0) {
          this.centrifugeRpm = Math.min(8.0, this.centrifugeRpm + 0.5 * dt);
        }
      }

      // Angular velocity omega = RPM * 2*pi / 60
      const omega = (this.centrifugeRpm * 2 * Math.PI) / 60;
      const centAcc = omega * omega * this.centrifugeRadius;
      this.gravityMetrics.artificialG = +(centAcc / 9.80665).toFixed(3);

      // Local effective gravity in the ship (0g in spine modules, artificialG in ring)
      this.gravityMetrics.effectiveG = this.gravityMetrics.artificialG;

      // 2. Dynamic Mass Balance & Center of Mass (CoM) Shift
      // Calculate current mass of each module
      let totalMass = 0;
      let weightedZ = 0;
      let ringAsymmetry = 0;

      const zPositions = {
        bridge: 6.0,
        centrifuge: 2.0,
        science: -1.5,
        avionics: -4.5,
        reactor: -8.0,
        propulsion: -13.0
      };

      for (const [key, sec] of Object.entries(this.sections)) {
        // Air mass = pressure / (R_spec * T) * volume
        const airDensity = (sec.pressure * 1000) / (287.05 * (sec.temperature + 273.15));
        const currentAirMass = sec.vented ? 0 : Math.max(0, airDensity * sec.volume);
        const currentFuelMass = sec.fuelMass;
        const currentModuleMass = sec.baseMass + currentAirMass + currentFuelMass;

        totalMass += currentModuleMass;
        weightedZ += currentModuleMass * zPositions[key];

        // Centrifuge ring asymmetry calculation
        if (sec.id === 'centrifuge') {
          // If vented or burning unevenly
          const nominalAirMass = (101300 / (287.05 * 294.65)) * sec.volume; // ~336 kg
          const airLost = nominalAirMass - currentAirMass;
          const fuelLost = 650 - currentFuelMass;
          ringAsymmetry = airLost + fuelLost;
          if (sec.abandoned) ringAsymmetry += 2500; // equipment jettison/lockout imbalance
        }
      }

      const nominalCoM_Z = -1.82; // baseline Z center of mass
      const actualCoM_Z = weightedZ / totalMass;
      const comShift = Math.abs(actualCoM_Z - nominalCoM_Z);
      this.gravityMetrics.centerOfMassShift = +comShift.toFixed(3);

      // Bearing strain due to dynamic centrifuge unbalance
      // Unbalance force F = delta_m * omega^2 * R
      const unbalanceForce = ringAsymmetry * omega * omega * this.centrifugeRadius;
      const baseBearingStress = 10.0;
      const dynamicStress = (unbalanceForce / 45000) * 100;
      this.gravityMetrics.bearingStress = Math.min(100, Math.round(baseBearingStress + dynamicStress));
      this.gravityMetrics.wobbleRms = +(Math.min(12.0, (dynamicStress / 100) * 4.5 * (this.centrifugeRpm / 8.0))).toFixed(2);

      if (this.gravityMetrics.bearingStress > 85 && this.centrifugeRpm > 3.0) {
        if (Math.random() < 0.1) {
          this.addAlert('CENTRIFUGE BEARING STRAIN CRITICAL', `Dynamic unbalance from mass loss is inducing ${this.gravityMetrics.wobbleRms}°/s nutation. Slow centrifuge down immediately!`, 'danger', 'centrifuge');
        }
      }

      // 3. Planetary and Lunar Orbital Gravity
      const r_earth = EARTH_RADIUS + this.orbitalAltitude;
      const g_earth = (G_CONST * EARTH_MASS) / (r_earth * r_earth);
      this.gravityMetrics.planetaryG = +g_earth.toFixed(3);

      // Microgravity gradient / tidal acceleration across 32m spacecraft
      const g_tidal = (2 * G_CONST * EARTH_MASS * this.length) / (r_earth * r_earth * r_earth);
      this.gravityMetrics.lunarG = +(g_tidal * 1e5).toFixed(4); // micro-m/s²
      this.gravityMetrics.netOrbitalG = +(g_tidal / 9.81).toFixed(7);

      // 4. Orbital Decay Mechanics
      // If propulsion section is abandoned or IVC-1 is fried, station-keeping burns cannot be executed
      const secF = this.sections.propulsion;
      const propOperational = (secF.electronics.primary.health > 0 && secF.electronics.primary.online) ||
        (secF.electronics.backup.health > 0 && secF.electronics.backup.online && secF.electronics.backup.status === 'ACTIVE');

      if (!propOperational || secF.abandoned) {
        this.orbitalDecayRisk = true;
        // Low earth orbit atmospheric drag decays altitude without RCS burns
        const dragFactor = this.orbitalAltitude < 300000 ? 85 : 18;
        this.orbitalAltitude = Math.max(120000, this.orbitalAltitude - dragFactor * dt);
        this.orbitalVelocity = Math.sqrt((G_CONST * EARTH_MASS) / (EARTH_RADIUS + this.orbitalAltitude));

        // Calculate time to atmospheric burnup (120 km threshold)
        const altitudeRemaining = this.orbitalAltitude - 120000;
        this.orbitTimeRemaining = Math.max(0, Math.round(altitudeRemaining / dragFactor));

        if (this.orbitalAltitude < 250000) {
          this.addAlert('ORBITAL DECAY WARNING', `Propulsion offline! Altitude dropping at ${dragFactor} m/s under Earth gravity. Re-entry in ~${Math.round(this.orbitTimeRemaining / 60)} min!`, 'danger', 'propulsion');
        }
      } else {
        this.orbitalDecayRisk = false;
        this.orbitTimeRemaining = null;
      }

      // 5. Determine Flame Regime from gravity & atmosphere
      if (this.gravityMetrics.effectiveG < 0.05) {
        this.gravityMetrics.flameRegime = 'micro_ball';
      } else {
        this.gravityMetrics.flameRegime = 'buoyant';
      }
    }

    // -------------------------------------------------------------
    // Fire Spread & Material Kinetics Engine
    // -------------------------------------------------------------
    updateFirePhysics(dt) {
      for (const [key, sec] of Object.entries(this.sections)) {
        const mat = MATERIAL_DATABASE[sec.materialId] || MATERIAL_DATABASE.nomex;

        // If vented to space: P -> 0, O2 -> 0.
        // Vacuum purge extinguishes all standard fires!
        // EXCEPTION: Li-Ion thermal runaway (self-oxidizing cathode breakdown)!
        if (sec.vented) {
          sec.pressure = Math.max(0, sec.pressure - 25.0 * dt);
          sec.o2 = Math.max(0, sec.o2 - 6.0 * dt);

          if (sec.materialId !== 'li_ion') {
            if (sec.burning) {
              sec.burning = false;
              sec.fireSize = 0;
              sec.heatReleaseRate = 0;
              this.logEvent(`Vacuum purge successful in ${sec.name}. Flame extinguished by oxygen starvation.`, 'success');
              this.addAlert('FIRE PURGED BY VACUUM', `${sec.name} depressurized. Flame starved of oxidizer.`, 'info', sec.id);
            }
          } else {
            // Li-ion continues thermal runaway even in vacuum unless cooled!
            if (sec.burning && sec.temperature > mat.pyrolysisTemp) {
              sec.fireSize = Math.max(0.15, sec.fireSize - 0.01 * dt);
            }
          }
        }

        // Fire Suppression Flooding (CO2 / Novec)
        if (sec.suppressantFlooded) {
          sec.o2 = Math.max(0, sec.o2 - 3.5 * dt);
          if (sec.o2 < mat.loi && sec.materialId !== 'li_ion') {
            sec.burning = false;
            sec.fireSize = Math.max(0, sec.fireSize - 0.2 * dt);
            if (sec.fireSize === 0) {
              sec.suppressantFlooded = false;
              this.logEvent(`Suppressant gas successfully extinguished fire in ${sec.name}.`, 'success');
            }
          }
        }

        if (sec.burning && sec.fuelMass > 0) {
          const g = sec.id === 'centrifuge' ? this.gravityMetrics.artificialG : 0.0;
          const isMicroG = g < 0.05;

          // Check if environment can sustain combustion
          const canSustain = sec.materialId === 'li_ion' || sec.o2 >= (isMicroG ? mat.loi + 2.0 : mat.loi);

          if (!canSustain) {
            // Flame starves
            sec.fireSize = Math.max(0, sec.fireSize - 0.1 * dt);
            if (sec.fireSize <= 0.02) {
              sec.burning = false;
              sec.fireSize = 0;
              sec.heatReleaseRate = 0;
              this.logEvent(`Flame in ${sec.name} self-extinguished: O₂ level (${sec.o2.toFixed(1)}%) below material LOI (${mat.loi}%).`, 'info');
              continue;
            }
          } else {
            // Fire growth equation: V_spread depends on g, O2, pressure, and material HRR
            // Under microgravity, diffusion limitation slows down burn
            const gFactor = isMicroG ? 0.35 : 0.75 + 0.45 * Math.sqrt(g);
            const o2Factor = Math.max(0.1, (sec.o2 - mat.loi) / 10.0 + 0.6);
            const pFactor = Math.sqrt(Math.max(0.1, sec.pressure / 101.3));

            const growthRate = (mat.hrrPeak / 300.0) * gFactor * o2Factor * pFactor * 0.08;
            sec.fireSize = Math.min(1.0, sec.fireSize + growthRate * dt);

            // Heat Release Rate (kW)
            sec.heatReleaseRate = Math.round(sec.fireSize * mat.hrrPeak * (sec.o2 / 21.0) * pFactor);

            // Fuel consumption
            const fuelConsumedRate = (sec.heatReleaseRate / (mat.heatOfCombustion * 1000)) * dt; // kg
            sec.fuelMass = Math.max(0, sec.fuelMass - fuelConsumedRate);
            sec.charFraction = Math.min(mat.charFraction, sec.charFraction + 0.005 * dt);

            // Oxygen consumption: Thornton's rule ~13.1 MJ per kg O2 consumed
            const o2ConsumedMass = (sec.heatReleaseRate * dt) / 13100; // kg O2
            const compartmentAirMass = ((sec.pressure * 1000) / (287.05 * (sec.temperature + 273.15))) * sec.volume;
            const deltaO2Pct = (o2ConsumedMass / Math.max(1, compartmentAirMass * 0.23)) * 21.0;
            sec.o2 = Math.max(0, sec.o2 - deltaO2Pct);

            // Temperature elevation in compartment
            // dT = (Q_rel - Q_loss) / (m_air * c_v + m_struct * c_s)
            const heatInput = sec.heatReleaseRate * dt; // kJ
            const thermalMass = compartmentAirMass * 0.718 + sec.baseMass * 0.9; // kJ/K
            const deltaTemp = (heatInput * 0.65) / thermalMass;
            sec.temperature = Math.min(1150, +(sec.temperature + deltaTemp * 8.0).toFixed(1));

            // Toxic gas generation
            sec.co_ppm = Math.min(2500, Math.round(sec.co_ppm + sec.fireSize * 18 * dt));
            sec.smokeDensity = Math.min(1.5, +(sec.smokeDensity + sec.fireSize * 0.015 * dt).toFixed(3));

            // Cool flame transition in microgravity
            if (isMicroG && sec.o2 < mat.loi + 4.0 && sec.fireSize > 0.1 && sec.fireSize < 0.4) {
              sec.coolFlame = true;
            } else {
              sec.coolFlame = false;
            }

            // High heat damages electronics in section
            this.applyThermalDamageToElectronics(sec, dt);

            // Fire spread across bulkheads to adjacent modules!
            if (sec.temperature > 320 && !sec.doorsSealed) {
              for (const nKey of sec.neighbors) {
                const neighbor = this.sections[nKey];
                if (neighbor && !neighbor.burning && !neighbor.vented) {
                  // Conduction heating
                  neighbor.temperature += (sec.temperature - neighbor.temperature) * 0.005 * dt;
                  const nMat = MATERIAL_DATABASE[neighbor.materialId];
                  if (neighbor.temperature >= nMat.ignitionTemp && neighbor.o2 >= nMat.loi) {
                    neighbor.burning = true;
                    neighbor.fireSize = 0.15;
                    this.logEvent(`CRITICAL: Flashover! Fire propagated from ${sec.name} through open bulkhead into ${neighbor.name}!`, 'danger');
                    this.addAlert('FLASHOVER DETECTED', `Fire spread into ${neighbor.name} due to radiant heat!`, 'danger', neighbor.id);
                  }
                }
              }
            }
          }
        } else {
          // Fire is not active - gradual cooling
          if (sec.temperature > 22.0) {
            sec.temperature = Math.max(22.0, +(sec.temperature - 0.8 * dt).toFixed(1));
          }
          if (sec.co_ppm > 8) {
            sec.co_ppm = Math.max(8, Math.round(sec.co_ppm - 2 * dt));
          }
          if (sec.smokeDensity > 0.01) {
            sec.smokeDensity = Math.max(0.01, +(sec.smokeDensity - 0.004 * dt).toFixed(3));
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Electronics Subsystems, Redundancy & Damage Engine
    // -------------------------------------------------------------
    applyThermalDamageToElectronics(sec, dt) {
      const p = sec.electronics.primary;
      const b = sec.electronics.backup;

      // Primary heating
      if (sec.temperature > 70.0) {
        p.temp = Math.min(180, p.temp + (sec.temperature - p.temp) * 0.03 * dt);
        if (p.temp > 85.0 && p.health > 0) {
          p.health = Math.max(0, p.health - (p.temp - 85) * 0.08 * dt);
          if (p.health < 60 && p.status === 'NOMINAL') p.status = 'OVERHEATING';
          if (p.health < 20 && p.status !== 'DEGRADED') p.status = 'DEGRADED';
          if (p.health <= 0) {
            p.status = 'FRIED';
            p.online = false;
            p.voltage = 0;
            this.logEvent(`PRIMARY ELECTRONICS FAILURE: ${p.name} in ${sec.name} burnt out from excessive thermal load.`, 'danger');
            this.handlePrimaryFailover(sec);
          }
        }
      }

      // Secondary heating (rad-hardened with thermal isolation)
      if (sec.temperature > 120.0 && b.health > 0) {
        b.temp = Math.min(160, b.temp + (sec.temperature - b.temp) * 0.015 * dt);
        if (b.temp > 115.0) {
          b.health = Math.max(0, b.health - (b.temp - 115) * 0.05 * dt);
          if (b.health <= 0) {
            b.status = 'FRIED';
            b.online = false;
            b.voltage = 0;
            this.logEvent(`TOTAL ELECTRONICS BLACKOUT in ${sec.name}! Backup computer ${b.name} destroyed. Section abandonment mandatory.`, 'danger');
            this.triggerMandatoryAbandonment(sec);
          }
        }
      }
    }

    handlePrimaryFailover(sec) {
      const b = sec.electronics.backup;
      if (b.online && b.health > 0 && b.autoFailover) {
        b.status = 'ACTIVE';
        this.logEvent(`AUTOMATIC FAILOVER: Redundant backup ${b.name} took over control of ${sec.name}.`, 'warning');
        this.addAlert('FAILOVER ACTIVE', `${b.name} operating on emergency 28V DC bus in ${sec.name}.`, 'warning', sec.id);
      } else {
        this.triggerMandatoryAbandonment(sec);
      }
    }

    triggerMandatoryAbandonment(sec) {
      if (sec.abandoned) return;
      this.logEvent(`EMERGENCY ORDER: ${sec.name} has lost all electronic control systems. EVACUATION AND ABANDONMENT REQUIRED.`, 'danger');
      this.addAlert('MANDATORY SECTION ABANDONMENT', `Total electronics failure in ${sec.name}! Seal blast doors and abandon compartment to protect ship integrity.`, 'danger', sec.id);
    }

    abandonSection(sectionId) {
      const sec = this.sections[sectionId];
      if (!sec) return false;

      sec.abandoned = true;
      sec.doorsSealed = true;
      sec.crewPresent = 0; // Crew evacuated

      this.logEvent(`Section ${sec.code} (${sec.name}) has been officially ABANDONED. Bulkhead blast doors locked.`, 'warning');
      this.addAlert('SECTION ABANDONED', `${sec.name} isolated. Mass unbalance applied to spacecraft dynamics.`, 'warning', sec.id);

      return true;
    }

    ventSectionToVacuum(sectionId) {
      const sec = this.sections[sectionId];
      if (!sec) return false;

      sec.vented = true;
      sec.doorsSealed = true;

      this.logEvent(`EMERGENCY DECOMPRESSION: ${sec.name} vented directly to outer space. Atmosphere escaping to vacuum.`, 'danger');
      this.addAlert('VACUUM PURGE ACTIVE', `${sec.name} explosive decompression in progress. Depressurizing to 0.0 kPa.`, 'info', sec.id);

      return true;
    }

    suppressSection(sectionId) {
      const sec = this.sections[sectionId];
      if (!sec) return false;

      sec.suppressantFlooded = true;
      this.logEvent(`CO2/Novec fire suppression released into ${sec.name}. Oxygen dilution initiated.`, 'info');
      return true;
    }

    igniteSection(sectionId, materialId = null) {
      const sec = this.sections[sectionId];
      if (!sec || sec.vented) return false;

      if (materialId) sec.materialId = materialId;
      sec.burning = true;
      sec.fireSize = 0.25;
      sec.temperature = Math.max(sec.temperature, 260.0);

      this.logEvent(`FIRE ALARM TRIGGERED in ${sec.name}! Fuel: ${MATERIAL_DATABASE[sec.materialId]?.name || 'Unknown'}.`, 'danger');
      this.addAlert('FIRE DETECTED', `Active thermal plume detected in ${sec.name}.`, 'danger', sec.id);
      return true;
    }

    resetSection(sectionId) {
      const sec = this.sections[sectionId];
      if (!sec) return false;

      sec.burning = false;
      sec.coolFlame = false;
      sec.fireSize = 0;
      sec.heatReleaseRate = 0;
      sec.temperature = 22.0;
      sec.pressure = 101.3;
      sec.o2 = 21.0;
      sec.co_ppm = 8;
      sec.smokeDensity = 0.01;
      sec.fuelMass = 250;
      sec.charFraction = 0;
      sec.abandoned = false;
      sec.vented = false;
      sec.doorsSealed = false;
      sec.suppressantFlooded = false;

      // Restore electronics
      sec.electronics.primary.health = 100;
      sec.electronics.primary.status = 'NOMINAL';
      sec.electronics.primary.online = true;
      sec.electronics.primary.voltage = sec.electronics.primary.nominalVoltage;
      sec.electronics.primary.temp = 32.0;

      sec.electronics.backup.health = 100;
      sec.electronics.backup.status = 'STANDBY';
      sec.electronics.backup.online = true;
      sec.electronics.backup.voltage = sec.electronics.backup.nominalVoltage;
      sec.electronics.backup.temp = 25.0;

      this.logEvent(`Section ${sec.name} overhauled, repressurized, and returned to flight status.`, 'info');
      return true;
    }

    // -------------------------------------------------------------
    // Solar Flare & EMP Physics Engine
    // -------------------------------------------------------------
    triggerSolarFlare(flareClass = 'X10') {
      this.flareActive = true;
      this.flareClass = flareClass;

      let intensity = 50;
      let empPeak = 80; // V/m induced
      let protonFlux = 1000;

      switch (flareClass) {
        case 'C5':
          intensity = 15;
          empPeak = 20;
          protonFlux = 50;
          break;
        case 'M3':
          intensity = 40;
          empPeak = 65;
          protonFlux = 450;
          break;
        case 'X1':
          intensity = 70;
          empPeak = 110;
          protonFlux = 2500;
          break;
        case 'X10':
          intensity = 90;
          empPeak = 190;
          protonFlux = 12000;
          break;
        case 'Carrington_X45':
          intensity = 100;
          empPeak = 380;
          protonFlux = 85000;
          break;
      }

      this.flareIntensity = intensity;
      this.logEvent(`SOLAR WARNING: Class ${flareClass} Solar Flare erupted from active sunspot cluster. CME shockwave approaching at 1,850 km/s!`, 'warning');
      this.addAlert('SOLAR FLARE INCOMING', `Class ${flareClass} proton storm & EMP front will impact ship in T-3 seconds!`, 'warning');

      // Execute impact after brief arrival delay
      setTimeout(() => {
        this.processSolarImpact(empPeak, protonFlux);
      }, 2500);
    }

    processSolarImpact(empPeak, protonFlux) {
      this.logEvent(`SOLAR CME IMPACT: High-energy solar protons and EMP shockwave striking spacecraft hull!`, 'danger');

      // Effective EMP field reaching inside modules after hull shielding
      const shieldDeflection = this.shieldStrength / 100.0;
      const netEmp = empPeak * (1.0 - shieldDeflection * 0.65);

      for (const [key, sec] of Object.entries(this.sections)) {
        const p = sec.electronics.primary;
        const b = sec.electronics.backup;

        // Calculate induced voltage spike across circuit boards
        // Spike ~ netEmp * couplingFactor / shielding
        const shieldRatio = Math.pow(10, p.shieldingDb / 20.0);
        const voltageSpike = (netEmp * 420.0) / shieldRatio;

        p.voltage = +(p.nominalVoltage + voltageSpike).toFixed(1);

        // If voltage spike exceeds component dielectric breakdown threshold (> 155V)
        if (p.voltage > 155.0) {
          p.health = Math.max(0, p.health - Math.round((p.voltage - 155.0) * 1.8));
          p.temp += 28.0;

          if (p.health <= 0) {
            p.status = 'FRIED';
            p.online = false;
            p.voltage = 0;
            this.logEvent(`ELECTRICAL SURGE: ${p.name} in ${sec.name} FRIED by solar EMP voltage spike!`, 'danger');

            // Arc fire ignition risk! Fried electronics can spark and ignite Kapton insulation
            if (!sec.burning && !sec.vented && Math.random() < 0.65) {
              sec.burning = true;
              sec.fireSize = 0.2;
              sec.temperature += 65.0;
              this.logEvent(`IGNITION: Electrical arcing in ${sec.name} wire harness ignited surrounding insulation!`, 'danger');
              this.addAlert('ARC FIRE IGNITED', `Solar EMP arcing ignited electrical fire in ${sec.name}!`, 'danger', sec.id);
            }

            this.handlePrimaryFailover(sec);
          } else {
            p.status = 'DEGRADED';
          }
        }

        // Extremely high Carrington-class flare can overcome even backup rad-hardened GaN
        if (netEmp > 160) {
          const bShieldRatio = Math.pow(10, b.shieldingDb / 20.0);
          const bSpike = (netEmp * 280.0) / bShieldRatio;
          b.voltage = +(b.nominalVoltage + bSpike).toFixed(1);

          if (b.voltage > 42.0) {
            b.health = Math.max(0, b.health - Math.round((b.voltage - 42.0) * 2.5));
            if (b.health <= 0) {
              b.status = 'FRIED';
              b.online = false;
              b.voltage = 0;
              this.logEvent(`CATASTROPHIC EMP: Redundant backup ${b.name} in ${sec.name} fried by coronal proton saturation!`, 'danger');
              this.triggerMandatoryAbandonment(sec);
            }
          }
        }
      }

      this.flareActive = false;
    }

    // -------------------------------------------------------------
    // Master Simulation Step
    // -------------------------------------------------------------
    step(dt = 0.5) {
      this.time += dt;
      this.updateGravityPhysics(dt);
      this.updateFirePhysics(dt);

      // Return concise telemetry snapshot
      return this.getTelemetrySnapshot();
    }

    getTelemetrySnapshot() {
      let activeFires = 0;
      let totalHrr = 0;
      let friedCount = 0;
      let abandonedCount = 0;

      for (const sec of Object.values(this.sections)) {
        if (sec.burning) {
          activeFires++;
          totalHrr += sec.heatReleaseRate;
        }
        if (sec.electronics.primary.status === 'FRIED') friedCount++;
        if (sec.abandoned) abandonedCount++;
      }

      return {
        time: this.time,
        activeFires,
        totalHrr,
        friedCount,
        abandonedCount,
        artificialG: this.gravityMetrics.artificialG,
        effectiveG: this.gravityMetrics.effectiveG,
        bearingStress: this.gravityMetrics.bearingStress,
        wobbleRms: this.gravityMetrics.wobbleRms,
        comShift: this.gravityMetrics.centerOfMassShift,
        flameRegime: this.gravityMetrics.flameRegime,
        orbitalAltitude: Math.round(this.orbitalAltitude / 1000), // km
        orbitalVelocity: Math.round(this.orbitalVelocity), // m/s
        orbitalDecayRisk: this.orbitalDecayRisk,
        orbitTimeRemaining: this.orbitTimeRemaining
      };
    }
  }

  // -------------------------------------------------------------
  // AI Emergency Chatbot Engine (AURA / Spacecraft FireGPT)
  // -------------------------------------------------------------
  class AuraChatbot {
    constructor(simulation) {
      this.sim = simulation;
      this.history = [];
    }

    generateEmergencyBriefing() {
      const sim = this.sim;
      const burningSections = Object.values(sim.sections).filter((s) => s.burning);
      const friedSections = Object.values(sim.sections).filter((s) => s.electronics.primary.status === 'FRIED');
      const abandonedSections = Object.values(sim.sections).filter((s) => s.abandoned);

      if (burningSections.length === 0 && friedSections.length === 0) {
        return {
          title: 'SYSTEMS NOMINAL',
          status: 'GREEN',
          message: 'All 6 spacecraft sections report nominal atmosphere and thermal parameters. Habitation Centrifuge Ring is spinning steadily at 8.0 RPM generating 1.0g. No thermal anomalies or electrical surges detected.',
          actions: ['Run diagnostic sweep', 'Inspect fire sensors', 'Review emergency protocols']
        };
      }

      let text = '';
      if (burningSections.length > 0) {
        text += `🔥 CRITICAL THERMAL EVENT DETECTED in ${burningSections.length} module(s): `;
        text += burningSections.map((s) => `${s.name} (${s.temperature.toFixed(0)}°C, O₂: ${s.o2.toFixed(1)}%, Fuel: ${MATERIAL_DATABASE[s.materialId]?.name})`).join('; ') + '. ';
      }

      if (friedSections.length > 0) {
        text += `⚡ ELECTRONICS BLACKOUT in: ` + friedSections.map((s) => s.name).join(', ') + '. ';
      }

      if (sim.gravityMetrics.bearingStress > 70) {
        text += `⚠️ DYNAMIC UNBALANCE: Centrifuge bearing stress at ${sim.gravityMetrics.bearingStress}%. Mass shift is inducing ${sim.gravityMetrics.wobbleRms}°/s nutation. `;
      }

      if (sim.orbitalDecayRisk) {
        text += `🚨 ORBITAL DECAY IN PROGRESS: Propulsion offline! Spacecraft losing altitude under Earth gravity. Re-entry in ~${Math.round(sim.orbitTimeRemaining / 60)} minutes! `;
      }

      return {
        title: 'EMERGENCY ADVISORY IN EFFECT',
        status: burningSections.length > 0 ? 'RED' : 'YELLOW',
        message: text,
        burningCount: burningSections.length,
        friedCount: friedSections.length
      };
    }

    ask(query) {
      const q = query.toLowerCase();
      const sim = this.sim;

      // 1. Where is the fire?
      if (q.includes('where') && (q.includes('fire') || q.includes('flame') || q.includes('burn'))) {
        const burning = Object.values(sim.sections).filter((s) => s.burning);
        if (burning.length === 0) {
          return {
            reply: 'No active fires are detected anywhere on board the NSS Prometheus. All thermal infrared sensors report cabin temperatures within nominal range (15°C–32°C).',
            citations: ['NASA PSI-26 BASS', 'Flight Rule ECLSS-104']
          };
        }
        const details = burning.map((s) => {
          const mat = MATERIAL_DATABASE[s.materialId];
          const g = s.id === 'centrifuge' ? sim.gravityMetrics.artificialG : 0.0;
          const flameShape = g < 0.05 ? 'spherical blue diffusion flame (microgravity)' : 'elongated flickering orange teardrop (buoyant artificial gravity)';
          return `• **${s.name} (${s.code})**:\n  - Temperature: **${s.temperature.toFixed(0)}°C** | HRR: **${s.heatReleaseRate} kW**\n  - Oxygen: **${s.o2.toFixed(1)}%** | Pressure: **${s.pressure.toFixed(1)} kPa**\n  - Fuel: **${mat.name}** (${mat.category})\n  - Flame physics: ${flameShape}\n  - Toxic gases: CO ${s.co_ppm} ppm, Smoke ${s.smokeDensity.toFixed(2)} OD/m`;
        }).join('\n\n');

        return {
          reply: `⚠️ **Active Fire Report:**\n\n${details}\n\n**Immediate recommendation**: Turn off ventilation dampers to prevent smoke spread, isolate power buses to stop arcing, and evaluate whether to flood with CO₂ or execute Emergency Vacuum Venting.`,
          citations: ['NASA Saffire-IV Flight Data', 'NASA PSI-69 FLEX', 'Apollo 1 Post-Mortem Analysis']
        };
      }

      // 2. How to resolve / put out fire
      if (q.includes('how') && (q.includes('resolve') || q.includes('extinguish') || q.includes('put out') || q.includes('suppress'))) {
        const burning = Object.values(sim.sections).filter((s) => s.burning);
        if (burning.length === 0) {
          return {
            reply: 'Standard spacecraft fire response protocol:\n1. **Stop Forced Air**: Immediately shut down ECLSS recirculator fans to prevent forced convection from feeding oxygen to the flame front.\n2. **Isolate Power**: Trip primary 120V bus breakers in the affected zone to remove electrical ignition sources.\n3. **Suppress or Vent**: Deploy portable CO₂/Fine Water Mist extinguishers. If fire involves self-oxidizing batteries or spreads uncontrollably, seal blast doors and execute **Emergency Vacuum Depressurization** to space.\n4. **Monitor for Cool Flames**: In microgravity, flames can linger invisibly at ~500°C. Do not repressurize until infrared thermal cameras confirm zero heat signature.',
            citations: ['NASA SP-2016-ECLSS', 'ISS Emergency Fire Response Handbook']
          };
        }

        const target = burning[0];
        const mat = MATERIAL_DATABASE[target.materialId];
        let strat = '';

        if (target.materialId === 'li_ion') {
          strat = `⚠️ **CRITICAL WARNING FOR LITHIUM-ION THERMAL RUNAWAY IN ${target.code}:**\nLithium-ion NMC cells decompose exothermically and release atomic oxygen internally (LOI = 0%). Standard vacuum purging or CO₂ flooding **will NOT** stop cathode decomposition!\n\n**Mandatory Protocol:**\n1. Evacuate crew immediately and lock Bulkhead blast doors.\n2. Execute **Vacuum Purge** to remove flammable hydrogen and toxic HF gases and prevent hull over-pressurization.\n3. Keep emergency coolant shunts active to draw thermal energy below the 160°C thermal runaway propagation threshold.\n4. Abandon section if structural bulkheads exceed 500°C.`;
        } else {
          strat = `**Suppression Strategy for ${target.name}:**\n• **Material**: ${mat.name} (LOI: ${mat.loi}%).\n• **Current O₂**: ${target.o2.toFixed(1)}%.\n• **Option A — CO₂ Flooding**: Inject inert suppressant gas to drive O₂ below ${mat.loi}%. The flame will starve without needing to vent cabin air.\n• **Option B — Emergency Vacuum Purge**: Open decompression valves to space ($101.3 \\to 0\\text{ kPa}$). The absence of oxidizer will instantly suffocate the fire.\n• **Caution**: Venting air dumps mass, which will shift spacecraft Center of Mass by ~${(target.volume * 1.2 / 1000).toFixed(2)}m and induce centrifuge spin wobble!`;
        }

        return {
          reply: strat,
          citations: ['NASA Saffire-I Flight Experiment', 'NASA PSI-62 Material Tests']
        };
      }

      // 3. Solar flare & fried electronics
      if (q.includes('solar') || q.includes('flare') || q.includes('fried') || q.includes('emp')) {
        return {
          reply: `☀️ **Solar Flare & EMP Mechanics on NSS Prometheus:**\n\nWhen an X-class Solar Flare or Coronal Mass Ejection (CME) hits the spacecraft:\n1. **Electromagnetic Pulse (EMP)**: Time-varying magnetic flux induces high-voltage surges ($>180\\text{V}$) across electrical wiring traces.\n2. **Dielectric Breakdown**: Primary 120V bus semiconductors experience gate oxide puncture, rendering primary flight computers **FRIED**.\n3. **Secondary Electrical Arcing**: Fried wire harnesses spark violently, igniting adjacent Kapton polyimide insulation ($T_{ign} = 560^\\circ\\text{C}$).\n4. **Redundant Backup Electronics**: Our secondary computers operate on an isolated 28V DC bus with Gallium-Nitride (GaN) radiation-hardened semiconductors and up to 80 dB attenuation shielding. They automatically engage via **Failover** within 120 milliseconds.\n5. **Extreme Flare Vulnerability**: Carrington-class events (X45+) can overwhelm even backup shielding, forcing a mandatory section abandonment.`,
          citations: ['NASA DONKI Space Weather Service', 'CCMC Space Weather Model', 'NOAA Space Weather Scales']
        };
      }

      // 4. Gravity effect & Centrifuge
      if (q.includes('gravity') || q.includes('centrifuge') || q.includes('wobble') || q.includes('spin') || q.includes('orbit')) {
        const gArt = sim.gravityMetrics.artificialG;
        const rpm = sim.centrifugeRpm;
        const stress = sim.gravityMetrics.bearingStress;
        const gPlan = sim.gravityMetrics.planetaryG;

        return {
          reply: `🌐 **Gravitational Dynamics Breakdown:**\n\n1. **Internal Artificial Gravity ($a_c = \\omega^2 R$):**\n   - Current Centrifuge Rotation: **${rpm.toFixed(1)} RPM** at 14m radius $\\implies$ **${gArt.toFixed(2)}g**.\n   - In the spine modules (Bridge, Science, Reactor): Net gravity is **0.00g** (freefall microgravity).\n\n2. **Combustion Sensitivity to Gravity:**\n   - In **0.0g**, buoyancy is zero ($Gr = 0$). Hot air does not rise. Flames form tranquil **spherical blue balls** governed by molecular diffusion. Combustion is slow but soot accumulates.\n   - In **1.0g** (Centrifuge), buoyant convection pulls hot air inward toward the hub, entraining fresh O₂ and elongating flames into **turbulent teardrops** with $3\\times$ faster spread rates!\n\n3. **Mass Redistribution & Centrifuge Wobble:**\n   - When a compartment is vented or abandoned, gas and equipment mass is lost. This shifts the Center of Mass by **${sim.gravityMetrics.centerOfMassShift}m**.\n   - Unbalance force creates bearing strain (**${stress}%**) and precession nutation (**${sim.gravityMetrics.wobbleRms}°/s**).\n\n4. **External Planetary Gravity (${sim.orbitalBody.toUpperCase()}):**\n   - Spacecraft feels external gravitational acceleration of **${gPlan.toFixed(2)} m/s²**.\n   - In orbit, centrifugal forward velocity (${sim.orbitalVelocity} m/s) cancels planet gravity, creating weightlessness. However, if propulsion electronics fry, atmospheric drag causes **orbital decay** toward atmospheric skip/burnup!`,
          citations: ['NASA BASS (Burning and Suppression of Solids)', 'NASA PSI-159 CFI-G', 'Orbital Mechanics for Engineering Students']
        };
      }

      // 5. Section abandonment
      if (q.includes('abandon') || q.includes('door') || q.includes('evacuate') || q.includes('seal')) {
        return {
          reply: `🚪 **Section Abandonment Protocol (NASA Flight Rule 14.8):**\n\nWhen a compartment loses both its Primary and Secondary electronics, or when fire temperatures exceed 400°C:\n1. All crew must immediately evacuate into the forward or aft safe-havens.\n2. **Hermetic Blast Doors** seal across bulkheads, isolating air circulation.\n3. The compartment is declared **ABANDONED**.\n4. To protect structural integrity from thermal conduction, flight controllers may execute an **Emergency Vacuum Vent** to space.\n5. Abandoning the Centrifuge or Propulsion bay removes significant stabilizing mass and requires recalculating the attitude control gyro matrices.`,
          citations: ['Mir Station Fire Post-Mortem (1997)', 'NASA Spaceflight Operations Guidelines']
        };
      }

      // Default comprehensive assistant answer
      return {
        reply: `I am AURA (Autonomous Utility & Rescue Assistant), flight controller AI for the NSS Prometheus.\n\nI am continuously monitoring real-time telemetry across our 6 modules:\n• **Fire Spread & Pyrolysis Kinetics**: Tracking fuel mass, O₂ depletion, and toxic CO/HCN ppm.\n• **Electronics Grid**: Monitoring 120V Primary & 28V Rad-Hardened Backup health, voltages, and EMP susceptibility.\n• **Centrifuge & Orbital Gravity**: Computing centrifugal artificial gravity, mass balance wobble, and planetary orbital decay.\n\nYou can ask me:\n- *"Where is the fire and what's burning?"*\n- *"How do I resolve the thermal runaway in the Reactor?"*\n- *"Why did the solar flare fry our avionics?"*\n- *"How does zero gravity change flame shape?"*\n- *"What happens if we abandon the centrifuge ring?"*`,
        citations: ['NASA PSI Repository', 'NASA NTRS 20150023456']
      };
    }
  }

  // Export to window
  window.MATERIAL_DATABASE = MATERIAL_DATABASE;
  window.SpacecraftSimulation = SpacecraftSimulation;
  window.AuraChatbot = AuraChatbot;

})(window);
