const winston = require('winston');

// Every log line will automatically have trace_id, span_id injected by dd-trace
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()   // JSON format = Datadog can parse and index every field
  ),
  transports: [new winston.transports.Console()]
});

module.exports = logger;
