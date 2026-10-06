/**
 * Serverless API Route: /api/openai
 * OpenAI Fallback Integration for FireGPT & Aura Unified Assistant
 * 
 * Safely accesses process.env.OPENAI_API_KEY server-side.
 * The API key is NEVER exposed to the frontend.
 * Only invoked when the Common Intents System (/data/intents.json) lacks the required information.
 */

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  let body = {};
  try {
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      // If body wasn't pre-parsed by middleware
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch (e) {
            resolve({});
          }
        });
        req.on('error', reject);
      });
    }
  } catch (parseErr) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload.' }));
    return;
  }

  const prompt = (body.prompt || body.message || body.query || '').trim();
  const pageContext = body.pageContext || 'FlameAtlas Dashboard';
  const history = Array.isArray(body.history) ? body.history : [];

  if (!prompt) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Prompt is required.' }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // If OPENAI_API_KEY is not configured on the server
  if (!apiKey) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      hasKey: false,
      reply: `I received your query regarding "${prompt}".\n\n*Notice: The server-side \`OPENAI_API_KEY\` environment variable is not currently set on the host server.* To enable dynamic generative AI answers, configure \`OPENAI_API_KEY\` in your environment or \`.env\` file.\n\nIn the meantime, the verified **NASA Physical Sciences Informatics (PSI)** knowledge base is active. You can ask about materials flammability (Nomex, Kapton, PMMA), microgravity flame physics (spherical blue flames vs buoyant teardrops), ECLSS cabin atmospheres (Moon 34% O₂, ISS 21% O₂), solar storm alerts (DONKI flares), or spacecraft emergency protocols.`,
      citations: ['NASA PSI Repository', 'NASA NTRS 20150023456', 'ECLSS Flight Rule 14.8'],
      source: 'Serverless Assistant (Awaiting OPENAI_API_KEY Configuration)'
    }));
    return;
  }

  // Format messages for OpenAI Chat Completions API
  const systemPrompt = `You are FireGPT, the unified scientific AI assistant for FlameAtlas (NASA Space Apps 2026: Flame in Freefall), combining FireGPT research retrieval and the AURA Flight & Tactical Assistant.
Your primary role is to clearly and accurately explain microgravity combustion, spacecraft fire safety, space weather, and mission parameters based on NASA Physical Sciences Informatics (PSI), NASA Technical Reports Server (NTRS), and NASA ECLSS standards.
The user is currently viewing the page: "${pageContext}".
Explain the science clearly, accurately, and concisely. Where applicable, cite relevant NASA experiments (e.g., PSI-26 BASS, PSI-69 FLEX, PSI-47 DAFT, Saffire) or flight rules. Maintain a helpful and authoritative spaceflight science tone.`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Append recent history if available (limit to last 6 turns)
  history.slice(-6).forEach((h) => {
    if (h.role && h.text) {
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text
      });
    }
  });

  messages.push({ role: 'user', content: prompt });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 650
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      res.statusCode = apiRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: false,
        error: `OpenAI API returned status ${apiRes.status}`,
        details: errText
      }));
      return;
    }

    const data = await apiRes.json();
    const replyText = data.choices?.[0]?.message?.content || 'No response generated.';

    // Extract any mentioned citations or provide standard NASA Open Science
    const citations = ['OpenAI Synthesis', 'NASA PSI / NTRS Open Science'];

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      hasKey: true,
      reply: replyText,
      citations: citations,
      source: `OpenAI ${model} (Serverless Fallback)`,
      model: model
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: 'Failed to communicate with OpenAI API.',
      details: err.message
    }));
  }
};
