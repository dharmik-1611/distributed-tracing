// MUST be the very first import in every service
// This auto-instruments HTTP, Express, and propagates trace headers automatically
const tracer = require('dd-trace').init({
  logInjection: true,        // Injects trace_id + span_id into every winston log
  analytics: true,
  runtimeMetrics: true,
  plugins: {
    http: { server: true, client: true },  // auto-propagates traceparent headers
    express: { enabled: true }
  }
});

module.exports = tracer;
