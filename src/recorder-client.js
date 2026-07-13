/**
 * recorder-client.js — HTTP calls to the Recorder Service
 */

import fetch from 'node-fetch';

const BASE = () => process.env.RECORDER_SERVICE_URL || 'http://localhost:9200';

/**
 * POST /internal/recorder/auth
 */
export async function recorderAuth(apiKey, phone) {
  const res = await fetch(`${BASE()}/internal/recorder/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, phone }),
  });
  if (!res.ok) return { ok: false };
  return res.json();
}

/**
 * POST /internal/recorder/event
 */
export async function recorderEvent(payload) {
  const res = await fetch(`${BASE()}/internal/recorder/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`recorder event ${res.status}`);
  return res.json();
}

/**
 * POST /internal/recorder/presence
 */
export async function recorderPresence(payload) {
  try {
    await fetch(`${BASE()}/internal/recorder/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget — presence loss is non-fatal
  }
}

/**
 * POST /internal/recorder/ingest — streams body through
 * Returns the Response object so caller can pipe status back.
 */
export async function recorderIngest(headers, bodyStream) {
  const res = await fetch(`${BASE()}/internal/recorder/ingest`, {
    method: 'POST',
    headers,
    body: bodyStream,
    duplex: 'half',
  });
  return res;
}

/**
 * Quick reachability check (HEAD or GET /health on recorder).
 */
export async function recorderHealthCheck() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE()}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /internal/recorder/pair?code=XXXX
 * Device polls this to get its api_key after admin binds the code.
 */
export async function recorderPair(code) {
  const res = await fetch(`${BASE()}/internal/recorder/pair?code=${encodeURIComponent(code)}`);
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error || 'Pair failed');
    err.status = res.status;
    throw err;
  }
  return body;
}
