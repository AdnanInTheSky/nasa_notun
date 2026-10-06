/**
 * FlameAtlas Local Dev & Serverless Simulation Server
 * Zero-dependency Node.js HTTP server.
 * 
 * - Serves static frontend assets (.html, .js, .css, .json, etc.)
 * - Routes /api/* to serverless handler functions in ./api/
 * - Loads environment variables from .env if present
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple .env parser (zero-dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read .env file:', e.message);
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Route mapping for /api/*
const apiHandlers = {
  '/api/donki': require('./api/donki'),
  '/api/openai': require('./api/openai'),
  '/api/intents': require('./api/intents')
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';

  // Check API routes
  if (pathname.startsWith('/api/')) {
    const cleanPath = pathname.replace(/\/$/, '');
    const handler = apiHandlers[cleanPath];

    if (handler) {
      try {
        await handler(req, res);
      } catch (err) {
        console.error(`Error in ${cleanPath}:`, err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: `API route ${cleanPath} not found.` }));
      return;
    }
  }

  // Static file serving
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>404 Not Found</h1><p>Resource ${pathname} not found.</p>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 FlameAtlas Server running at: http://localhost:${PORT}`);
  console.log(`📡 Serverless APIs active:`);
  console.log(`   - GET  /api/donki    (NASA DONKI Space Weather)`);
  console.log(`   - POST /api/openai   (OpenAI Fallback Engine)`);
  console.log(`   - POST /api/intents  (Common Intents Search Engine)`);
  console.log(`   - GET  /api/intents  (Common Intents Metadata)`);
  console.log(`📑 OpenAPI / Swagger UI: http://localhost:${PORT}/api-docs.html`);
  console.log(`====================================================`);
});
