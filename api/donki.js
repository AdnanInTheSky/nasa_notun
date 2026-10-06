/**
 * Serverless API Route: /api/donki
 * NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)
 * 
 * Fetches live solar flare observations from NASA's official DONKI API.
 * Falls back server-side to /data/donki-snapshot.json if the NASA API is unreachable.
 */

const fs = require('fs');
const path = require('path');

const CLASS_FLUX = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };
const DAY_MS = 86400000;

function parseLocation(loc) {
  const m = /([NS])(\d+)([EW])(\d+)/.exec(loc || '');
  if (!m) return { lat: 0, lon: 0 };
  return {
    lat: (m[1] === 'N' ? 1 : -1) * Number(m[2]),
    lon: (m[3] === 'W' ? 1 : -1) * Number(m[4])
  };
}

function normalizeFlare(f) {
  const cls = (f.classType || 'C1.0').trim();
  const letter = cls[0].toUpperCase();
  const mag = parseFloat(cls.slice(1)) || 1;
  const flux = (CLASS_FLUX[letter] || 1e-6) * mag;
  const linked = (f.linkedEvents || []).map((e) => (typeof e === 'string' ? e : e.activityID || ''));
  const { lat, lon } = parseLocation(f.sourceLocation);
  const begin = new Date(f.beginTime);
  const end = f.endTime ? new Date(f.endTime) : begin;
  return {
    id: f.flrID || `FLR-${Date.now()}`,
    classType: cls,
    letter,
    flux,
    level: Math.log10(flux) + 8,
    begin: begin.toISOString(),
    peak: (f.peakTime ? new Date(f.peakTime) : begin).toISOString(),
    endTime: end.toISOString(),
    durationMin: Math.max(1, Math.round((end - begin) / 60000)),
    location: f.sourceLocation || 'N00W00',
    lat,
    lon,
    region: f.activeRegionNum || 14500,
    hasCME: linked.some((id) => id.includes('CME')) || Boolean(f.hasCME),
    hasSEP: linked.some((id) => id.includes('SEP')) || Boolean(f.hasSEP),
    cmeSpeed: f.cmeSpeed || (linked.some((id) => id.includes('CME')) ? 950 : 450),
    bz: f.bz !== undefined ? f.bz : -8.5,
    link: f.link || 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/'
  };
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const apiKey = url.searchParams.get('apiKey') || process.env.NASA_API_KEY || 'DEMO_KEY';

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * DAY_MS);
  const isoDate = (d) => d.toISOString().slice(0, 10);

  const donkiEndpoint = `https://api.nasa.gov/DONKI/FLR?startDate=${isoDate(startDate)}&endDate=${isoDate(endDate)}&api_key=${apiKey}`;

  // Attempt live NASA DONKI fetch with a 3.5s timeout
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);

    const apiRes = await fetch(donkiEndpoint, { signal: ctrl.signal });
    clearTimeout(timer);

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        const flares = data.map(normalizeFlare).sort((a, b) => new Date(a.peak) - new Date(b.peak));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          count: flares.length,
          source: 'NASA DONKI API (Live Feed via /api/donki)',
          live: true,
          asOf: endDate.toISOString(),
          flares
        }));
        return;
      }
    }
  } catch (err) {
    // Fall through to snapshot on network error or timeout
  }

  // Fallback to verified local snapshot
  try {
    let snapData = null;
    try {
      snapData = require('../data/donki-snapshot.json');
    } catch (reqErr) {
      const snapshotPath = path.join(__dirname, '..', 'data', 'donki-snapshot.json');
      if (fs.existsSync(snapshotPath)) {
        snapData = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      }
    }

    if (Array.isArray(snapData) && snapData.length > 0) {
      const flares = snapData.map(normalizeFlare).sort((a, b) => new Date(a.peak) - new Date(b.peak));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: true,
        count: flares.length,
        source: 'NASA DONKI Verified Snapshot (Server-Side Fallback)',
        live: false,
        asOf: '2026-09-26T00:00:00.000Z',
        flares
      }));
      return;
    }
  } catch (snapErr) {
    // If snapshot read fails, return error
  }

  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: false,
    error: 'Failed to retrieve NASA DONKI data from both live API and local snapshot.',
    flares: []
  }));
};
