require('./tracer');
const express = require('express');
const logger = require('./logger');

const app = express();
app.use(express.json());

const ERROR_RATE = parseInt(process.env.ERROR_RATE || '15');

// In-memory store simulating a DB
const store = [];

app.post('/save', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'];
  const userId = req.headers['x-user-id'];

  // Simulate DB query latency
  await new Promise(r => setTimeout(r, 20 + Math.random() * 80));

  const shouldFail = Math.random() * 100 < ERROR_RATE;

  if (shouldFail) {
    const errors = [
      'Connection pool exhausted',
      'Deadlock detected — transaction rolled back',
      'Unique constraint violation'
    ];
    const errMsg = errors[Math.floor(Math.random() * errors.length)];

    logger.error('DB Service: Write failed', {
      correlationId, userId,
      error: errMsg,
      service: 'db-service'
    });

    return res.status(500).json({
      success: false,
      failedAt: 'db-service',
      error: errMsg,
      correlationId
    });
  }

  const record = {
    id: `rec-${Date.now()}`,
    userId,
    correlationId,
    savedAt: new Date().toISOString(),
    data: req.body
  };
  store.push(record);

  logger.info('DB Service: Record saved', {
    correlationId, userId,
    recordId: record.id,
    service: 'db-service'
  });

  res.json({ success: true, recordId: record.id });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'db-service', records: store.length }));
app.listen(5004, () => logger.info(`DB Service running on :5004 — error rate: ${ERROR_RATE}%`));
