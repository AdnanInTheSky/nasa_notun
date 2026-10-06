/**
 * FlameAtlas Unified Assistant Engine (FireGPT + Aura Assistant)
 * 
 * Unifies FireGPT (NASA research explainer) and AURA (spacecraft flight & tactical AI)
 * into a single unified assistant system available across all pages.
 * 
 * Data Flow:
 * 1. User question
 * 2. Check Common Intents file (/data/intents.json) as the first source of truth
 *    - Page-specific intents & current page context
 *    - Tactical telemetry rules (AURA spacecraft kinetics)
 *    - General microgravity combustion knowledge base
 * 3. If found -> Return verified response + citations
 * 4. If not found -> Call serverless OpenAI API (/api/openai) as fallback
 * 5. Return AI-generated response
 */

(function (window, document) {
  'use strict';

  // Helper: Markdown formatter for chat bubbles
  function formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code `text`
    html = html.replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-slate-800 text-pink-300 font-mono text-[11px]">$1</code>');
    // Bullet lists
    html = html.replace(/^• (.*)$/gm, '<li class="ml-3 list-disc">$1</li>');
    html = html.replace(/^- (.*)$/gm, '<li class="ml-3 list-disc">$1</li>');
    // Newlines
    html = html.replace(/\n\n/g, '<div class="h-2"></div>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  // Detect current page identifier
  function getCurrentPageKey() {
    if (typeof window === 'undefined') return 'index.html';
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return filename.toLowerCase();
  }

  // Unified Assistant Core Class
  class UnifiedAssistantCore {
    constructor() {
      this.intentsData = null;
      this.loaded = false;
      this.activeSim = null;
      this.initPromise = this.loadIntents();
    }

    async loadIntents() {
      try {
        const res = await fetch('./data/intents.json');
        if (res.ok) {
          this.intentsData = await res.json();
          this.loaded = true;
          return this.intentsData;
        }
      } catch (e) {
        console.warn('Failed to load ./data/intents.json, attempting fallback:', e);
      }

      // Emergency fallback structure if network fails
      this.intentsData = {
        name: 'FlameAtlas In-Memory Fallback',
        page_intents: {},
        kb: [
          {
            keys: ['nomex', 'moon', '34'],
            answer: 'In a 34% O₂ / 8.2 psi Moon habitat, Nomex HT90-40 is expected to sustain upward flame spread. BASS samples self-extinguished in ISS air but spread once O₂ exceeded ~30%.',
            citations: ['PSI-26 BASS', 'NTRS 20150023456']
          },
          {
            keys: ['cool flame', 'invisible'],
            answer: 'Cool flames are low-temperature (~500–800 K) reactions that emit almost no visible light. FLEX observed n-heptane droplets continuing to burn in a cool-flame regime after the hot flame extinguished.',
            citations: ['PSI-69 FLEX', 'PSI-159 CFI-G']
          }
        ]
      };
      this.loaded = true;
      return this.intentsData;
    }

    // Attach active simulation if on spacecraft page
    attachSimulation(sim) {
      this.activeSim = sim;
    }

    // Retrieve page explanation
    getPageExplanation(pageKey) {
      const page = pageKey || getCurrentPageKey();
      if (!this.intentsData || !this.intentsData.page_intents) return null;
      const config = this.intentsData.page_intents[page];
      if (config) {
        const explainIntent = config.intents ? config.intents.find(i => i.id.includes('explain')) : null;
        return {
          pageName: config.pageName,
          summary: config.summary,
          details: explainIntent ? explainIntent.answer : config.summary,
          citations: explainIntent ? explainIntent.citations : ['NASA Open Science', 'ECLSS Standards'],
          suggested: config.suggested || []
        };
      }
      return null;
    }

    // Suggested queries for current page
    getSuggestedQueries(pageKey) {
      const page = pageKey || getCurrentPageKey();
      if (this.intentsData && this.intentsData.page_intents && this.intentsData.page_intents[page]) {
        return this.intentsData.page_intents[page].suggested || [];
      }
      return (this.intentsData && this.intentsData.suggested_global) || [
        'Explain this page',
        'Why does fire burn as a sphere in 0g?',
        'Will Nomex burn in 34% oxygen?',
        'How do cool flames work?'
      ];
    }

    // Check dynamic spacecraft telemetry (AURA engine integration)
    checkDynamicTelemetry(query) {
      if (!this.activeSim) return null;
      const q = query.toLowerCase();
      const sim = this.activeSim;

      // 1. Where is the fire query
      if (q.includes('where') && (q.includes('fire') || q.includes('flame') || q.includes('burn'))) {
        const burning = Object.values(sim.sections || {}).filter((s) => s.burning);
        if (burning.length === 0) {
          return {
            reply: '🛰️ **Spacecraft Telemetry Status: GREEN**\n\nNo active fires are detected anywhere on board the NSS Prometheus. All thermal infrared sensors report cabin temperatures within nominal range (15°C–32°C). Habitation Centrifuge Ring is spinning steadily at 8.0 RPM generating 1.0g.',
            citations: ['NASA PSI-26 BASS', 'Flight Rule ECLSS-104'],
            source: 'AURA Real-Time Telemetry Bus'
          };
        }
        const materials = window.MATERIAL_DATABASE || {};
        const details = burning.map((s) => {
          const mat = materials[s.materialId] || { name: 'Unknown fuel', category: 'General' };
          const g = s.id === 'centrifuge' ? (sim.gravityMetrics?.artificialG || 1.0) : 0.0;
          const flameShape = g < 0.05 ? 'spherical blue diffusion flame (microgravity)' : 'elongated flickering orange teardrop (buoyant artificial gravity)';
          return `• **${s.name} (${s.code})**:\n  - Temperature: **${s.temperature.toFixed(0)}°C** | HRR: **${s.heatReleaseRate || 0} kW**\n  - Oxygen: **${s.o2.toFixed(1)}%** | Pressure: **${s.pressure.toFixed(1)} kPa**\n  - Fuel: **${mat.name}** (${mat.category})\n  - Flame physics: ${flameShape}\n  - Toxic gases: CO ${s.co_ppm || 0} ppm, Smoke ${(s.smokeDensity || 0).toFixed(2)} OD/m`;
        }).join('\n\n');

        return {
          reply: `⚠️ **Active Compartment Fire Alert:**\n\n${details}\n\n**Immediate recommendation**: Turn off ventilation dampers to prevent smoke spread, isolate power buses to stop arcing, and evaluate whether to flood with CO₂ or execute Emergency Vacuum Venting.`,
          citations: ['NASA Saffire-IV Flight Data', 'NASA PSI-69 FLEX', 'Apollo 1 Post-Mortem Analysis'],
          source: 'AURA Dynamic Sensor Telemetry'
        };
      }

      // 2. Battery thermal runaway query
      if (q.includes('power core') || q.includes('battery') || (q.includes('thermal runaway') && q.includes('how'))) {
        return {
          reply: `⚠️ **CRITICAL PROTOCOL FOR BATTERY THERMAL RUNAWAY:**\nLithium-ion NMC cells decompose exothermically and release atomic oxygen internally (LOI = 0%). Standard vacuum purging or CO₂ flooding **will NOT** stop cathode decomposition!\n\n**Mandatory Protocol:**\n1. Evacuate crew immediately and lock Bulkhead blast doors.\n2. Execute **Vacuum Purge** to remove flammable hydrogen and toxic HF gases and prevent hull over-pressurization.\n3. Keep emergency coolant shunts active to draw thermal energy below the 160°C thermal runaway propagation threshold.\n4. Abandon section if structural bulkheads exceed 500°C.`,
          citations: ['NASA Battery Safety Standard JSC 20793', 'NASA Saffire-I Flight Experiment'],
          source: 'AURA Tactical Emergency Response'
        };
      }

      return null;
    }

    // Match query against Common Intents file
    matchCommonIntents(query, pageKey) {
      if (!this.intentsData) return null;
      const q = query.toLowerCase().trim();
      const activePage = pageKey || getCurrentPageKey();

      let best = null;
      let bestScore = 0;

      // 1. Check current page intents first (highest priority)
      if (this.intentsData.page_intents && this.intentsData.page_intents[activePage]?.intents) {
        for (const entry of this.intentsData.page_intents[activePage].intents) {
          let score = 0;
          for (const k of entry.keys) {
            if (q.includes(k.toLowerCase())) score += 3;
          }
          if (entry.questions) {
            for (const pq of entry.questions) {
              if (q.includes(pq.toLowerCase()) || pq.toLowerCase().includes(q)) score += 5;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            best = entry;
          }
        }
      }

      // 2. Check all other page intents
      if (this.intentsData.page_intents) {
        for (const [pk, pObj] of Object.entries(this.intentsData.page_intents)) {
          if (pk === activePage || !pObj.intents) continue;
          for (const entry of pObj.intents) {
            let score = 0;
            for (const k of entry.keys) {
              if (q.includes(k.toLowerCase())) score += 1.5;
            }
            if (entry.questions) {
              for (const pq of entry.questions) {
                if (q.includes(pq.toLowerCase()) || pq.toLowerCase().includes(q)) score += 3.5;
              }
            }
            if (score > bestScore) {
              bestScore = score;
              best = entry;
            }
          }
        }
      }

      // 3. Check general knowledge base (kb)
      if (Array.isArray(this.intentsData.kb)) {
        for (const entry of this.intentsData.kb) {
          let score = 0;
          for (const k of entry.keys) {
            if (q.includes(k.toLowerCase())) score += 2;
          }
          if (score > bestScore) {
            bestScore = score;
            best = entry;
          }
        }
      }

      if (best && bestScore >= 2.5) {
        return {
          reply: best.answer,
          citations: best.citations || ['NASA PSI Repository'],
          source: 'Common Intents Engine (/data/intents.json)',
          confidence: best.confidence || 0.85
        };
      }

      return null;
    }

    // Call serverless OpenAI API fallback (/api/openai)
    async callOpenAiFallback(query, pageKey, history = []) {
      const pageInfo = this.getPageExplanation(pageKey);
      const pageTitle = pageInfo ? pageInfo.pageName : pageKey;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);

        const res = await fetch('/api/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: query,
            pageContext: pageTitle,
            history: history
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.reply) {
            return {
              reply: data.reply,
              citations: data.citations || ['OpenAI AI Synthesis', 'NASA PSI / NTRS Open Science'],
              source: data.source || 'OpenAI API (Serverless Fallback)',
              model: data.model
            };
          }
        }
      } catch (err) {
        console.warn('OpenAI serverless fallback request failed:', err);
      }

      // Graceful local fallback if offline or backend server not running
      return {
        reply: `I could not find an exact match for "${query}" in the Common Intents database, and the serverless OpenAI fallback is currently offline.\n\nFireGPT answers from indexed NASA Physical Sciences Informatics (PSI), NTRS reports, and spacecraft ECLSS flight rules. Try asking:\n• *"Explain this page"*\n• *"Will Nomex burn in 34% oxygen on the Moon?"*\n• *"Why are cool flames invisible?"*\n• *"How does zero gravity change flame shape?"*\n• *"What is the section abandonment protocol?"*`,
        citations: ['NASA PSI Repository', 'NASA NTRS 20150023456', 'Flight Rule 14.8'],
        source: 'FireGPT Offline NASA Fallback'
      };
    }

    // Main unified answer pipeline
    async ask(query, history = []) {
      await this.initPromise;
      const cleanQ = (query || '').trim();
      if (!cleanQ) return null;

      const pageKey = getCurrentPageKey();

      // Check "explain page" intent directly
      if (cleanQ.toLowerCase() === 'explain this page' || cleanQ.toLowerCase() === 'explain page' || cleanQ.toLowerCase().includes('what is this page')) {
        const pageExplain = this.getPageExplanation(pageKey);
        if (pageExplain) {
          return {
            reply: `📄 **${pageExplain.pageName} Overview:**\n\n${pageExplain.details}`,
            citations: pageExplain.citations,
            source: 'Common Intents Engine (/data/intents.json)'
          };
        }
      }

      // Step 1: Check dynamic telemetry if on spacecraft simulation
      const telemetryResult = this.checkDynamicTelemetry(cleanQ);
      if (telemetryResult) return telemetryResult;

      // Step 2: Check Common Intents as First Source of Truth
      const intentResult = this.matchCommonIntents(cleanQ, pageKey);
      if (intentResult) return intentResult;

      // Step 3: Fallback to Serverless OpenAI API
      const openAiResult = await this.callOpenAiFallback(cleanQ, pageKey, history);
      return openAiResult;
    }
  }

  // Create singleton instance
  const assistantCore = new UnifiedAssistantCore();

  // Backward compatibility wrapper for AURA Chatbot in space-craft.html
  class UnifiedAuraChatbotAdapter {
    constructor(simulation) {
      this.sim = simulation;
      assistantCore.attachSimulation(simulation);
    }

    generateEmergencyBriefing() {
      const sim = this.sim;
      const burningSections = Object.values(sim.sections || {}).filter((s) => s.burning);
      const friedSections = Object.values(sim.sections || {}).filter((s) => s.electronics?.primary?.status === 'FRIED');

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
        const materials = window.MATERIAL_DATABASE || {};
        text += `🔥 CRITICAL THERMAL EVENT in ${burningSections.length} module(s): `;
        text += burningSections.map((s) => `${s.name} (${s.temperature.toFixed(0)}°C, O₂: ${s.o2.toFixed(1)}%, Fuel: ${materials[s.materialId]?.name || 'Solid'})`).join('; ') + '. ';
      }

      if (friedSections.length > 0) {
        text += `⚡ ELECTRONICS BLACKOUT in: ` + friedSections.map((s) => s.name).join(', ') + '. ';
      }

      if (sim.gravityMetrics?.bearingStress > 70) {
        text += `⚠️ DYNAMIC UNBALANCE: Centrifuge bearing stress at ${sim.gravityMetrics.bearingStress}%. Mass shift is inducing ${sim.gravityMetrics.wobbleRms}°/s nutation. `;
      }

      if (sim.orbitalDecayRisk) {
        text += `🚨 ORBITAL DECAY IN PROGRESS: Propulsion offline! Spacecraft losing altitude under Earth gravity. Re-entry in ~${Math.round((sim.orbitTimeRemaining || 300) / 60)} minutes! `;
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
      // Synchronous return for space-craft.html compatibility
      const telemetry = assistantCore.checkDynamicTelemetry(query);
      if (telemetry) return telemetry;

      const intent = assistantCore.matchCommonIntents(query, 'space-craft.html');
      if (intent) return intent;

      return {
        reply: `Tactical telemetry processed. Citing NASA flight protocols for: "${query}".\n\nIf you need deep generative analysis, the unified FireGPT assistant floating widget or serverless backend is standing by.`,
        citations: ['NASA PSI-26 BASS', 'Flight Rule ECLSS-104']
      };
    }
  }

  // Alpine Store & Global Component for Unified Assistant
  function registerUnifiedAssistantStore() {
    if (typeof Alpine === 'undefined' || typeof Alpine.store !== 'function') return;
    if (Alpine.store('assistant')) return;

    const pageKey = getCurrentPageKey();
    const pageExplain = assistantCore.getPageExplanation(pageKey);
    const initialPageName = pageExplain ? pageExplain.pageName : 'Mission Control';

    Alpine.store('assistant', {
      isOpen: false,
      isMinimized: false,
      busy: false,
      queryInput: '',
      pageName: initialPageName,
      suggested: assistantCore.getSuggestedQueries(pageKey),
      messages: [
        {
          id: 'welcome',
          role: 'bot',
          text: `👋 **Welcome to FireGPT — Unified Flight & Science Assistant.**\n\nI combine NASA Physical Sciences Informatics (PSI) research with AURA's real-time spacecraft flight intelligence.\n\n📍 **Active Context**: *${initialPageName}*\n\nTap **Explain This Page** below or ask me anything about microgravity flames, spacecraft hazards, or space weather!`,
          citations: ['NASA PSI Repository', 'NTRS 20150023456'],
          source: 'Common Intents Engine (/data/intents.json)',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],

      toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
          this.refreshContext();
          if (window.sfx && typeof window.sfx.pop === 'function') window.sfx.pop();
          setTimeout(() => {
            if (window.lucide) window.lucide.createIcons();
            const el = document.getElementById('unified-assistant-messages');
            if (el) el.scrollTop = el.scrollHeight;
          }, 100);
        }
      },

      openWithPrompt(promptText) {
        this.isOpen = true;
        this.isMinimized = false;
        this.refreshContext();
        if (window.sfx && typeof window.sfx.pop === 'function') window.sfx.pop();
        if (promptText) {
          this.submit(promptText);
        }
        setTimeout(() => {
          if (window.lucide) window.lucide.createIcons();
          const el = document.getElementById('unified-assistant-messages');
          if (el) el.scrollTop = el.scrollHeight;
        }, 100);
      },

      refreshContext() {
        const pk = getCurrentPageKey();
        const pinfo = assistantCore.getPageExplanation(pk);
        this.pageName = pinfo ? pinfo.pageName : 'Mission Control';
        this.suggested = assistantCore.getSuggestedQueries(pk);
      },

      explainPage() {
        this.submit('Explain this page');
      },

      async submit(queryToRun) {
        const q = (queryToRun || this.queryInput).trim();
        if (!q || this.busy) return;
        this.queryInput = '';
        this.busy = true;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.messages.push({
          id: Date.now(),
          role: 'user',
          text: q,
          time: timeStr
        });

        this.scrollToBottom();

        // Query unified assistant pipeline
        const historyForApi = this.messages.map(m => ({ role: m.role, text: m.text }));
        const response = await assistantCore.ask(q, historyForApi);

        this.busy = false;
        this.messages.push({
          id: Date.now() + 1,
          role: 'bot',
          text: response.reply,
          citations: response.citations || [],
          source: response.source || 'Unified Assistant',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        // XP Reward & Sound
        if (Alpine.store('app') && typeof Alpine.store('app').addXp === 'function') {
          Alpine.store('app').addXp(10, 'FireGPT inquiry');
        }
        if (window.sfx && typeof window.sfx.ding === 'function') {
          window.sfx.ding();
        }

        this.scrollToBottom();
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 80);
      },

      scrollToBottom() {
        setTimeout(() => {
          const el = document.getElementById('unified-assistant-messages');
          if (el) el.scrollTop = el.scrollHeight;
        }, 60);
      }
    });
  }

  // Inject UI widget into DOM
  function injectAssistantWidget() {
    if (typeof document === 'undefined' || document.getElementById('unified-assistant-container')) return;

    const container = document.createElement('div');
    container.id = 'unified-assistant-container';
    container.innerHTML = `
      <!-- Floating Launcher Button -->
      <div class="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button @click="$store.assistant.toggle()"
                class="group relative flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-pink-500/40 shadow-xl shadow-pink-500/15 backdrop-blur-md transition-all hover:scale-105 active:scale-95 focus:outline-none">
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 text-white shadow-md">
            <i data-lucide="bot" class="w-4 h-4"></i>
            <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse"></span>
          </div>
          <div class="text-left hidden sm:block">
            <div class="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>FireGPT</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-mono">Unified</span>
            </div>
            <div class="text-[10px] text-slate-400 leading-tight">NASA Explainer & AURA</div>
          </div>
        </button>
      </div>

      <!-- Unified Assistant Modal / Drawer -->
      <div x-show="$store.assistant.isOpen"
           x-transition:enter="transition ease-out duration-300"
           x-transition:enter-start="opacity-0 translate-y-6 scale-95"
           x-transition:enter-end="opacity-100 translate-y-0 scale-100"
           x-transition:leave="transition ease-in duration-200"
           x-transition:leave-start="opacity-100 translate-y-0 scale-100"
           x-transition:leave-end="opacity-0 translate-y-6 scale-95"
           class="fixed bottom-20 right-4 sm:right-6 z-50 w-[95vw] sm:w-[440px] max-w-[460px] h-[580px] max-h-[85vh] flex flex-col rounded-2xl bg-slate-950/95 border border-pink-500/30 shadow-2xl shadow-pink-500/20 backdrop-blur-xl overflow-hidden font-sans text-slate-100"
           style="display: none;">

        <!-- Header -->
        <div class="px-4 py-3 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-pink-950/30 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <i data-lucide="bot" class="w-4.5 h-4.5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-white leading-none">FireGPT Unified Assistant</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono">v2.0</span>
              </div>
              <div class="text-[11px] text-slate-400 leading-tight mt-0.5">
                First source: <span class="text-cyan-400 font-mono">/data/intents.json</span> · Fallback: <span class="text-rose-400 font-mono">/api/openai</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button @click="$store.assistant.explainPage()" title="Explain current page"
                    class="px-2 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs flex items-center gap-1 transition-colors">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              <span class="text-[10px] font-semibold hidden xs:inline">Explain Page</span>
            </button>
            <button @click="$store.assistant.toggle()" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Active Context Sub-Bar -->
        <div class="px-4 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-slate-300">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="text-slate-400 text-[11px]">Context:</span>
            <span class="font-semibold text-slate-200" x-text="$store.assistant.pageName"></span>
          </div>
          <a href="fire-gpt.html" class="text-[11px] text-pink-400 hover:text-pink-300 flex items-center gap-1 underline underline-offset-2">
            <span>Full Portal & Quiz</span>
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </a>
        </div>

        <!-- Messages Area -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scroll" id="unified-assistant-messages">
          <template x-for="msg in $store.assistant.messages" :key="msg.id">
            <div class="flex flex-col space-y-1" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
              <div class="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono px-1">
                <span x-text="msg.role === 'user' ? 'Astronaut / Commander' : 'FireGPT Flight AI'"></span>
                <span>·</span>
                <span x-text="msg.time"></span>
              </div>

              <div class="max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed"
                   :class="msg.role === 'user' ? 'bg-gradient-to-tr from-pink-600 to-rose-600 text-white font-medium rounded-tr-none shadow-md shadow-pink-500/10' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none space-y-2'">
                <div x-html="window.formatAssistantMarkdown(msg.text)"></div>

                <!-- Source & Citations Metadata -->
                <div x-show="msg.role === 'bot' && (msg.citations || msg.source)" class="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div x-show="msg.source" class="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                    <span class="text-slate-500">Source:</span>
                    <span class="text-cyan-400" x-text="msg.source"></span>
                  </div>

                  <div x-show="msg.citations && msg.citations.length" class="flex flex-wrap items-center gap-1">
                    <span class="text-[9px] text-slate-500 font-mono">Cites:</span>
                    <template x-for="cit in msg.citations" :key="cit">
                      <span class="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[9px] text-pink-300 font-mono" x-text="cit"></span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Loading Indicator -->
          <div x-show="$store.assistant.busy" class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 italic">
            <span class="w-2.5 h-2.5 rounded-full bg-pink-400 animate-ping"></span>
            <span>Checking common intents & NASA PSI index...</span>
          </div>
        </div>

        <!-- Suggested Prompt Chips -->
        <div class="px-3 py-1.5 bg-slate-900/40 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
          <span class="text-slate-500 font-mono shrink-0">Ask:</span>
          <template x-for="chip in $store.assistant.suggested" :key="chip">
            <button @click="$store.assistant.submit(chip)"
                    class="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-slate-300 hover:text-white shrink-0 transition-colors whitespace-nowrap text-[10px]">
              <span x-text="chip"></span>
            </button>
          </template>
        </div>

        <!-- Input Bar -->
        <form @submit.prevent="$store.assistant.submit()" class="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
          <input type="text" x-model="$store.assistant.queryInput"
                 placeholder="Ask about microgravity fire, spacecraft status, NOMEX, cool flames..."
                 class="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/80 transition-colors">
          <button type="submit" :disabled="$store.assistant.busy || !$store.assistant.queryInput.trim()"
                  class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0">
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(container);
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 100);
  }

  // Global helper to open assistant with prompt
  function openFireGpt(promptText) {
    if (typeof Alpine !== 'undefined' && Alpine.store && Alpine.store('assistant')) {
      Alpine.store('assistant').openWithPrompt(promptText);
    }
  }

  // Register on window
  window.formatAssistantMarkdown = formatMarkdown;
  window.UnifiedAssistantCore = UnifiedAssistantCore;
  window.unifiedAssistant = assistantCore;
  window.AuraChatbot = UnifiedAuraChatbotAdapter;
  window.openFireGpt = openFireGpt;
  window.openAuraChat = openFireGpt; // alias for space-craft.html compatibility

  // Multi-stage hook initialization
  document.addEventListener('alpine:init', () => {
    registerUnifiedAssistantStore();
  });

  if (typeof Alpine !== 'undefined' && typeof Alpine.store === 'function') {
    registerUnifiedAssistantStore();
  }

  document.addEventListener('DOMContentLoaded', () => {
    registerUnifiedAssistantStore();
    injectAssistantWidget();
  });

  window.addEventListener('load', () => {
    registerUnifiedAssistantStore();
    injectAssistantWidget();
  });

})(window, document);
