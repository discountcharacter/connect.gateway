/**
 * health.js — GET /health
 */

import { Router } from 'express';
import * as registry from './registry.js';
import { recorderHealthCheck } from './recorder-client.js';

const router = Router();
const startTime = Date.now();

router.get('/health', async (req, res) => {
  const recorderReachable = await recorderHealthCheck();
  res.json({
    status: 'ok',
    connectedDevices: registry.count(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    recorderReachable,
  });
});

export default router;
