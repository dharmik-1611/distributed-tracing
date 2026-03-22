require('./tracer');
const express = require('express');
const axios = require('axios');
const logger = require('./logger');

const app = express();
app.use(express.json());

const BACKEND2_URL = process.env.BACKEND2_URL || 'http://localhost:5002';

app.post('/process', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'];
  const userId = req.headers['x-user-id'];

  logger.info('Backend-1: Processing request — validating and enriching payload', {
    correlationId, userId, service: 'backend-1'
  });

  // Simulate some auth/validation work
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

  const enrichedPayload = {
    ...req.body,
    enrichedAt: 'backend-1',
    timestamp: new Date().toISOString(),
    validatedUser: userId
  };

  try {
    // dd-trace auto-propagates trace headers to backend-2
    const response = await axios.post(`${BACKEND2_URL}/process`, enrichedPayload, {
      headers: {
        'x-correlation-id': correlationId,
        'x-user-id': userId
      },
      timeout: 10000
    });

    logger.info('Backend-1: Successfully forwarded to backend-2', { correlationId, userId });
    res.json(response.data);

  } catch (err) {
    logger.error('Backend-1: Downstream failure', {
      correlationId, userId,
      error: err.message,
      downstreamService: 'backend-2'
    });
    res.status(err.response?.status || 500).json({
      success: false,
      failedAt: err.response?.data?.failedAt || 'backend-1',
      error: err.message
    });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'backend-1' }));
app.listen(5001, () => logger.info('Backend-1 running on :5001'));
