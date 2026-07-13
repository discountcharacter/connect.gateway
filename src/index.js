/**
 * index.js — Express + WS server setup
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { attachWebSocket } from './ws-handler.js';
import { startSweep } from './registry.js';
import uploadRouter from './upload.js';
import fleetRouter from './fleet.js';
import healthRouter from './health.js';
import { recorderPair } from './recorder-client.js';

const PORT = parseInt(process.env.PORT, 10) || 8080;

const app = express();
app.use(express.json());

// Pair endpoint — no auth, device polls with its code
app.get('/pair', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ ok: false, error: 'Missing code' });
  try {
    const result = await recorderPair(code);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ ok: false, error: err.message || 'Pair failed' });
  }
});

// Routes
app.use(healthRouter);
app.use(fleetRouter);
app.use(uploadRouter);

// HTTP server
const server = createServer(app);

// Attach WebSocket upgrade handling
attachWebSocket(server);

// Start offline sweep
startSweep();

server.listen(PORT, () => {
  console.log(`[connect.gateway] listening on :${PORT}`);
});
