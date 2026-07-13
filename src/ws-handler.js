/**
 * ws-handler.js — WebSocket connection handling + message routing
 */

import { WebSocketServer } from 'ws';
import { validateDevice } from './auth.js';
import * as registry from './registry.js';
import { recorderEvent, recorderPresence } from './recorder-client.js';

/**
 * Attach WebSocket handling to an HTTP server.
 */
export function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    if (req.url !== '/ws/recorder') {
      socket.destroy();
      return;
    }

    const apiKey = req.headers['x-api-key'];
    const phone = req.headers['x-device-phone'];

    if (!apiKey || !phone) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const auth = await validateDevice(apiKey, phone);
    if (!auth.ok) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, auth);
    });
  });

  wss.on('connection', (ws, req, auth) => {
    const phone = req.headers['x-device-phone'];
    const { tenant_id, agent_user_id } = auth;

    // Register device
    registry.register(phone, ws, { tenant_id, agent_user_id });

    // Notify recorder service: device_online
    recorderPresence({ phone, state: 'online', tenant_id, agent_user_id });

    // Keepalive: ping every 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30_000);

    // Drop if no pong in 60s
    let pongReceived = true;
    const pongCheck = setInterval(() => {
      if (!pongReceived) {
        ws.terminate();
        return;
      }
      pongReceived = false;
    }, 60_000);

    ws.on('pong', () => {
      pongReceived = true;
    });

    // Message routing
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ error: 'invalid_json' }));
        return;
      }

      const { type, ...payload } = msg;

      switch (type) {
        case 'hello':
          registry.updateHello(phone, payload);
          break;

        case 'call_ringing':
          // Fire-and-forget
          recorderEvent({ type: 'call_ringing', tenant_id, agent_user_id, phone, ...payload }).catch(() => {});
          break;

        case 'call_started': {
          // Await response — relay verdict back
          try {
            const result = await recorderEvent({ type: 'call_started', tenant_id, agent_user_id, phone, ...payload });
            ws.send(JSON.stringify({ type: 'verdict', action: result.action, slug: result.slug || null }));
          } catch {
            // Default-allow if recorder is down
            ws.send(JSON.stringify({ type: 'verdict', action: 'record', slug: null }));
          }
          break;
        }

        case 'recording_started':
          registry.setRecording(phone, true);
          recorderEvent({ type: 'recording_started', tenant_id, agent_user_id, phone, ...payload }).catch(() => {});
          break;

        case 'call_progress':
          // Throttle: just forward (could add rate-limiting later)
          recorderEvent({ type: 'call_progress', tenant_id, agent_user_id, phone, ...payload }).catch(() => {});
          break;

        case 'call_ended':
          registry.setRecording(phone, false);
          recorderEvent({ type: 'call_ended', tenant_id, agent_user_id, phone, ...payload }).catch(() => {});
          break;

        case 'upload_done':
          recorderEvent({ type: 'upload_done', tenant_id, agent_user_id, phone, ...payload }).catch(() => {});
          break;

        case 'heartbeat':
          registry.touch(phone);
          recorderPresence({ phone, state: 'online', tenant_id, agent_user_id }).catch(() => {});
          break;

        default:
          ws.send(JSON.stringify({ error: 'unknown_type', type }));
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      clearInterval(pongCheck);
      registry.unregister(phone);
    });

    ws.on('error', () => {
      clearInterval(pingInterval);
      clearInterval(pongCheck);
      registry.unregister(phone);
    });
  });

  return wss;
}
