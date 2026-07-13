/**
 * registry.js — In-memory connection registry + offline sweep
 */

import { recorderPresence } from './recorder-client.js';

// phone → { socket, connectedAt, lastSeen, appVersion, device, fcmToken, recording, queue, tenant_id, agent_user_id }
const devices = new Map();

const OFFLINE_THRESHOLD_MS = () => (parseInt(process.env.OFFLINE_THRESHOLD_S, 10) || 120) * 1000;

/**
 * Register a device. If an old socket exists for the same phone, close it first.
 */
export function register(phone, socket, meta) {
  const existing = devices.get(phone);
  if (existing && existing.socket !== socket) {
    try { existing.socket.close(4001, 'replaced'); } catch { /* ignore */ }
  }
  devices.set(phone, {
    socket,
    connectedAt: new Date().toISOString(),
    lastSeen: Date.now(),
    appVersion: meta.appVersion || null,
    device: meta.device || null,
    fcmToken: meta.fcmToken || null,
    recording: false,
    queue: null,
    tenant_id: meta.tenant_id,
    agent_user_id: meta.agent_user_id,
  });
}

/**
 * Update fields on hello message.
 */
export function updateHello(phone, data) {
  const entry = devices.get(phone);
  if (!entry) return;
  if (data.app_version) entry.appVersion = data.app_version;
  if (data.device) entry.device = data.device;
  if (data.fcm_token) entry.fcmToken = data.fcm_token;
  entry.lastSeen = Date.now();
}

/**
 * Touch lastSeen for heartbeat.
 */
export function touch(phone) {
  const entry = devices.get(phone);
  if (entry) entry.lastSeen = Date.now();
}

/**
 * Mark recording state.
 */
export function setRecording(phone, val) {
  const entry = devices.get(phone);
  if (entry) entry.recording = !!val;
}

/**
 * Remove a device and notify recorder service.
 */
export async function unregister(phone) {
  const entry = devices.get(phone);
  if (!entry) return;
  devices.delete(phone);
  await recorderPresence({ phone, state: 'offline' });
}

/**
 * Get a device entry.
 */
export function get(phone) {
  return devices.get(phone) || null;
}

/**
 * Get the full fleet snapshot (no sockets exposed).
 */
export function snapshot() {
  const list = [];
  for (const [phone, entry] of devices) {
    list.push({
      phone,
      online: true,
      connectedAt: entry.connectedAt,
      lastSeen: new Date(entry.lastSeen).toISOString(),
      device: entry.device,
      appVersion: entry.appVersion,
      queue: entry.queue,
      recording: entry.recording,
      batteryExempt: false,
    });
  }
  return list;
}

/**
 * Count connected devices.
 */
export function count() {
  return devices.size;
}

/**
 * Offline sweep — called on interval.
 */
export async function sweep() {
  const threshold = Date.now() - OFFLINE_THRESHOLD_MS();
  const stale = [];
  for (const [phone, entry] of devices) {
    if (entry.lastSeen < threshold) {
      stale.push(phone);
    }
  }
  for (const phone of stale) {
    const entry = devices.get(phone);
    if (entry) {
      try { entry.socket.close(4002, 'stale'); } catch { /* ignore */ }
    }
    devices.delete(phone);
    await recorderPresence({ phone, state: 'offline' });
  }
}

/**
 * Start the sweep interval (every 30s).
 */
export function startSweep() {
  return setInterval(sweep, 30_000);
}
