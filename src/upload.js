/**
 * upload.js — POST /upload streaming multipart proxy
 */

import { Router } from 'express';
import Busboy from 'busboy';
import { recorderIngest } from './recorder-client.js';
import { validateDevice } from './auth.js';

const router = Router();

const MAX_UPLOAD_BYTES = () => parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 209715200;

router.post('/upload', async (req, res) => {
  // Auth
  const apiKey = req.headers['x-api-key'];
  const phone = req.headers['x-device-phone'];

  if (!apiKey || !phone) {
    return res.status(401).json({ error: 'missing credentials' });
  }

  const auth = await validateDevice(apiKey, phone);
  if (!auth.ok) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Check content-length hint
  const contentLength = parseInt(req.headers['content-length'], 10);
  if (contentLength > MAX_UPLOAD_BYTES()) {
    return res.status(413).json({ error: 'file too large' });
  }

  // Pipe the raw request body (multipart) straight to recorder service
  // Pass through content-type so boundary is preserved
  const forwardHeaders = {
    'content-type': req.headers['content-type'],
  };
  if (req.headers['content-length']) {
    forwardHeaders['content-length'] = req.headers['content-length'];
  }

  try {
    const recorderRes = await recorderIngest(forwardHeaders, req);
    const status = recorderRes.status;

    if (status >= 500) {
      return res.status(503).json({ error: 'recorder_unavailable', retryAfter: 5 });
    }

    const body = await recorderRes.json();
    return res.status(status).json(body);
  } catch (err) {
    return res.status(503).json({ error: 'recorder_unavailable', retryAfter: 5 });
  }
});

export default router;
