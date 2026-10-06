/**
 * Serverless API Route: /api/intents
 * Common Intents Engine & Knowledge Base API
 * 
 * Provides server-side query matching against /data/intents.json.
 * GET  /api/intents -> Returns summary of indexed intents, categories, and suggested queries
 * POST /api/intents -> Evaluates user query and returns matched intent or fallback trigger
 */

const fs = require('fs');
const path = require('path');

function loadIntents() {
  const filePath = path.join(__dirname, '..', 'data', 'intents.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return { kb: [], page_intents: {} };
}

function matchIntent(query, pageContext, intentsData) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return null;

  let best = null;
  let bestScore = 0;

  // 1. Check page-specific intents if pageContext provided
  if (pageContext && intentsData.page_intents) {
    const pageKeys = Object.keys(intentsData.page_intents);
    const matchedPageKey = pageKeys.find((k) => 
      k.toLowerCase().includes(pageContext.toLowerCase()) || 
      pageContext.toLowerCase().includes(k.replace('.html', '').toLowerCase()) ||
      (intentsData.page_intents[k].pageName && intentsData.page_intents[k].pageName.toLowerCase().includes(pageContext.toLowerCase()))
    );

    if (matchedPageKey && intentsData.page_intents[matchedPageKey]?.intents) {
      for (const entry of intentsData.page_intents[matchedPageKey].intents) {
        let score = 0;
        for (const k of entry.keys) {
          if (q.includes(k.toLowerCase())) score += 2;
        }
        if (entry.questions) {
          for (const pq of entry.questions) {
            if (q.includes(pq.toLowerCase()) || pq.toLowerCase().includes(q)) score += 3;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = entry;
        }
      }
    }
  }

  // 2. Search all page intents
  if (intentsData.page_intents) {
    for (const [pageKey, pageObj] of Object.entries(intentsData.page_intents)) {
      if (Array.isArray(pageObj.intents)) {
        for (const entry of pageObj.intents) {
          let score = 0;
          for (const k of entry.keys) {
            if (q.includes(k.toLowerCase())) score += 1.5;
          }
          if (score > bestScore) {
            bestScore = score;
            best = entry;
          }
        }
      }
    }
  }

  // 3. Search general knowledge base (kb)
  if (Array.isArray(intentsData.kb)) {
    for (const entry of intentsData.kb) {
      let score = 0;
      for (const k of entry.keys) {
        if (q.includes(k.toLowerCase())) score += 1.5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }

  // Minimum match threshold
  if (best && bestScore >= 1.5) {
    return { entry: best, score: bestScore };
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const intentsData = loadIntents();

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      name: intentsData.name || 'FlameAtlas Common Intents',
      version: intentsData.version || '1.0.0',
      totalKbEntries: intentsData.kb ? intentsData.kb.length : 0,
      totalPagesIndexed: intentsData.page_intents ? Object.keys(intentsData.page_intents).length : 0,
      suggestedQueries: intentsData.suggested_global || []
    }));
    return;
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      if (typeof req.body === 'object' && req.body !== null) {
        body = req.body;
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = await new Promise((resolve, reject) => {
          let raw = '';
          req.on('data', (c) => { raw += c; });
          req.on('end', () => {
            try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
          });
          req.on('error', reject);
        });
      }
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload.' }));
      return;
    }

    const query = (body.query || body.prompt || body.message || '').trim();
    const pageContext = body.pageContext || '';

    if (!query) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Query is required.' }));
      return;
    }

    const match = matchIntent(query, pageContext, intentsData);

    if (match) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: true,
        matched: true,
        score: match.score,
        reply: match.entry.answer,
        citations: match.entry.citations || ['NASA PSI Repository'],
        source: 'Common Intents Engine (/data/intents.json)',
        intentId: match.entry.id
      }));
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: true,
        matched: false,
        message: 'No matching common intent found. Call OpenAI API serverless fallback.',
        suggestedQueries: intentsData.suggested_global || []
      }));
    }
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed.' }));
};
