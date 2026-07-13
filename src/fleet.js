/**
 * fleet.js — GET /fleet + POST /push/:phone
 */

import { Router } from 'express';
import { validateServiceToken } from './auth.js';
import * as registry from './registry.js';

const router = Router();

/**
 * Middleware: validate X-Service-Token.
 */
function requireServiceToken(req, res, next) {
  const token = req.headers['x-service-token'];
  if (!token || !validateServiceToken(token)) {
    return res.status(401).json({ error: 'invalid service token' });
  }
  next();
}

/**
 * GET /fleet — full registry snapshot
 */
router.get('/fleet', requireServiceToken, (req, res) => {
  res.json(registry.snapshot());
});

/**
 * POST /push/:phone — deliver a message to a connected device
 */
router.post('/push/:phone', requireServiceToken, (req, res) => {
  const { phone } = req.params;
  const entry = registry.get(phone);

  if (!entry || !entry.socket || entry.socket.readyState !== 1) {
    return res.status(404).json({ error: 'device_offline' });
  }

  const payload = req.body;
  try {
    entry.socket.send(JSON.stringify(payload));
    res.json({ ok: true, delivered: true });
  } catch (err) {
    res.status(500).json({ error: 'send_failed' });
  }
});

export default router;
