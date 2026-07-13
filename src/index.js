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

const PORT = parseInt(process.env.PORT, 10) || 8080;

const app = express();
app.use(express.json());

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
