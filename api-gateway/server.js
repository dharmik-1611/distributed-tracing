require('./tracer'); // MUST be first line
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// Add uuid to package.json dep
const app = express();
app.use(express.json());

// CORS - allow frontend to call this gateway
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

const BACKEND1_URL = process.env.BACKEND1_URL || 'http://localhost:5001';

app.post('/api/process', async (req, res) => {
  // Generate a human-readable correlation/request ID
  // This travels with the request so user can look it up in Datadog
  const correlationId = req.headers['x-correlation-id'] || `req-${uuidv4()}`;
  const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous';

  logger.info('API Gateway: Request received', {
    correlationId,
    userId,
    body: req.body,
    service: 'api-gateway'
  });

  try {
    // dd-trace automatically injects traceparent + x-datadog-trace-id headers
    // when you make an axios call — zero manual work needed
    const response = await axios.post(`${BACKEND1_URL}/process`, req.body, {
      headers: {
        'x-correlation-id': correlationId,
        'x-user-id': userId
      },
      timeout: 10000
    });

    logger.info('API Gateway: Request completed successfully', { correlationId, userId });

    res.json({
      success: true,
      correlationId,   // Send back to frontend so user can search by this
      traceId: res.getHeader('x-datadog-trace-id'),
      data: response.data
    });

  } catch (err) {
    logger.error('API Gateway: Request failed', {
      correlationId,
      userId,
      error: err.message,
      status: err.response?.status
    });

    res.status(err.response?.status || 500).json({
      success: false,
      correlationId,
      error: err.message,
      failedAt: err.response?.data?.failedAt || 'api-gateway'
    });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

app.listen(4000, () => logger.info('API Gateway running on :4000'));
