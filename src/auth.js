/**
 * auth.js — Device key validation + caching
 */

import { recorderAuth } from './recorder-client.js';

// Cache: api_key:phone → { ok, tenant_id, agent_user_id, expiresAt }
const keyCache = new Map();

const CACHE_TTL_MS = (parseInt(process.env.DEVICE_KEY_CACHE_TTL_S, 10) || 300) * 1000;

/**
 * Validate device credentials against the recorder service.
 * Returns { ok, tenant_id, agent_user_id } or { ok: false }.
 */
export async function validateDevice(apiKey, phone) {
  const cacheKey = `${apiKey}:${phone}`;
  const cached = keyCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return { ok: true, tenant_id: cached.tenant_id, agent_user_id: cached.agent_user_id };
  }

  try {
    const result = await recorderAuth(apiKey, phone);
    if (result.ok) {
      keyCache.set(cacheKey, {
        tenant_id: result.tenant_id,
        agent_user_id: result.agent_user_id,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }
    return result;
  } catch {
    // If recorder service is unreachable during auth, deny
    return { ok: false };
  }
}

/**
 * Validate a service token for internal endpoints (fleet, push).
 */
export function validateServiceToken(token) {
  return token === process.env.SERVICE_TOKEN;
}
