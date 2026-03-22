require('./tracer');
const express = require('express');
const logger = require('./logger');

const app = express();
app.use(express.json());

// ERROR_RATE env var controls how often this service fails (default 40%)
const ERROR_RATE = parseInt(process.env.ERROR_RATE || '40');

const ERROR_SCENARIOS = [
  { type: 'TIMEOUT',          status: 504, message: 'AI model inference timed out — GPU throttled' },
  { type: 'RATE_LIMIT',       status: 429, message: 'AI service rate limit exceeded' },
  { type: 'MODEL_ERROR',      status: 500, message: 'Model returned malformed output' },
  { type: 'CONTEXT_TOO_LONG', status: 400, message: 'Input tokens exceed context window limit' }
];

app.post('/infer', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'];
  const userId = req.headers['x-user-id'];

  // Simulate realistic AI inference latency (200ms - 1.5s)
  const latency = 200 + Math.random() * 1300;
  await new Promise(r => setTimeout(r, latency));

  // Randomly fail based on ERROR_RATE
  const shouldFail = Math.random() * 100 < ERROR_RATE;

  if (shouldFail) {
    const scenario = ERROR_SCENARIOS[Math.floor(Math.random() * ERROR_SCENARIOS.length)];

    logger.error('AI Service: Inference failed', {
      correlationId, userId,
      errorType: scenario.type,
      latencyMs: Math.round(latency),
      service: 'ai-service'
    });

    return res.status(scenario.status).json({
      success: false,
      failedAt: 'ai-service',
      errorType: scenario.type,
      error: scenario.message,
      correlationId
    });
  }

  logger.info('AI Service: Inference successful', {
    correlationId, userId,
    latencyMs: Math.round(latency),
    tokensUsed: Math.floor(Math.random() * 500) + 100,
    service: 'ai-service'
  });

  res.json({
    success: true,
    prediction: `AI result for user ${userId}`,
    confidence: (0.7 + Math.random() * 0.3).toFixed(3),
    tokensUsed: Math.floor(Math.random() * 500) + 100,
    latencyMs: Math.round(latency)
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ai-service', errorRate: `${ERROR_RATE}%` }));
app.listen(5003, () => logger.info(`AI Service running on :5003 — error rate: ${ERROR_RATE}%`));
