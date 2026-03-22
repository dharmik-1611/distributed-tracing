# Distributed Tracing Demo with Datadog APM

End-to-end demo of distributed tracing across Node.js microservices.

You can use this project to:

- Understand traces, spans, and correlation IDs in a practical way.
- See one user request flow across multiple services.
- Learn the exact implementation pattern and reuse it in your own system.

## Why this matters

In microservices, one user action can touch many services. Without distributed tracing, debugging means manually hopping between logs and guessing timing.

With tracing, each request has a single trace context and timeline. You can answer:

- Which service was slow?
- Where did the error happen?
- What happened before and after the failure?

## Architecture

```text
Browser (localhost:3000)
  -> API Gateway (localhost:4000)      generates/accepts correlation ID
    -> Backend-1 (localhost:5001)      validation + enrichment
      -> Backend-2 (localhost:5002)    fan-out in parallel
        -> AI Service (localhost:5003) simulated AI inference (configurable errors)
        -> DB Service (localhost:5004) simulated DB write (configurable errors)

All services send traces/logs to Datadog Agent (localhost:8126)
```

## Distributed tracing concepts used in this project

- Trace: the full request journey across services.
- Span: one unit of work inside a service (for example an HTTP request handler).
- Parent-child spans: show call hierarchy between services.
- Correlation ID: business-level request ID that is easy for humans to search.
- Trace context propagation: passing context over HTTP headers so downstream spans join the same trace.

Important distinction:

- Trace ID is generated/managed by the tracing SDK.
- Correlation ID is an app-level identifier you control (header: x-correlation-id).
- In practice, keep both. Trace ID powers waterfall views; Correlation ID helps support teams search quickly.

## How this project implements tracing

1. Tracer initialization first

- Every service loads dd-trace before other imports.
- HTTP and Express are auto-instrumented.
- Log injection adds trace_id and span_id into logs.

2. Correlation ID at the edge

- API Gateway accepts x-correlation-id if provided.
- If missing, it generates one and forwards it downstream.

3. Header propagation between services

- Each outbound axios call forwards x-correlation-id and x-user-id.
- dd-trace automatically propagates tracing headers (traceparent and Datadog headers).

4. Structured JSON logging

- Logs include service name, correlation ID, user ID, and error details.
- Datadog can index/filter these fields directly.

## Prerequisites

- Docker Desktop running locally.
- Datadog account and API key.

Datadog site mapping:

| Datadog App URL       | DD_SITE value     |
| --------------------- | ----------------- |
| app.datadoghq.com     | datadoghq.com     |
| app.us5.datadoghq.com | us5.datadoghq.com |
| app.datadoghq.eu      | datadoghq.eu      |
| app.us3.datadoghq.com | us3.datadoghq.com |

## Quick start

1. Configure environment

```bash
# Linux/macOS
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Set your API key in .env:

```env
DD_API_KEY=your_32_character_api_key
```

Set DD_SITE inside docker-compose.yml under datadog-agent.

2. Start all services

```bash
docker compose up --build
```

3. Open the app

http://localhost:3000

4. Generate traffic

- Send single requests from the UI.
- Then run bulk requests (5/20) to generate enough traces for dashboards.

## Verify the system is working

Use health endpoints:

```bash
curl http://localhost:4000/health
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
curl http://localhost:5004/health
```

Send one request directly to API Gateway:

```bash
curl -X POST http://localhost:4000/api/process \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: corr-demo-001" \
  -H "x-user-id: usr-demo-01" \
  -d '{"action":"checkout","cart":["item-a"]}'
```

Expected response includes:

- success
- correlationId
- result payload from downstream services (or partial/fallback result when a service fails)

## Find traces in Datadog

1. Go to APM -> Traces -> Explorer.
2. Filter by service and env:

```text
service:api-gateway env:demo
```

3. Open a trace and inspect:

- Waterfall: end-to-end timing.
- Flame graph: nested span cost.
- Map: service dependency graph.

Search by correlation ID (depending on your indexed facets, try one of these):

```text
@http.headers.x-correlation-id:corr-demo-001
@http.request_headers.x-correlation-id:corr-demo-001
@x-correlation-id:corr-demo-001
correlationId:corr-demo-001
```

If no result appears immediately, wait 30-90 seconds for ingestion.

## Failure simulation and what to observe

- AI service has configurable random failures (ERROR_RATE, default 20 in compose).
- DB service has configurable random failures (ERROR_RATE, default 10 in compose).
- Backend-2 calls AI and DB in parallel and returns partial success when only one fails.

This helps you see realistic behavior:

- upstream service successful with downstream partial failure
- where latency is spent
- how errors appear in trace waterfall and logs

## Implement this pattern in your own microservices

Use this checklist when adding distributed tracing to a new Node.js service:

1. Install dependencies

```bash
npm install dd-trace winston express axios
```

2. Create tracer module and load it first in your app entrypoint

```js
// tracer.js
require("dd-trace").init({
  logInjection: true,
  runtimeMetrics: true,
  plugins: {
    http: { server: true, client: true },
    express: { enabled: true },
  },
});
```

```js
// server.js (first line)
require("./tracer");
```

3. Create/forward correlation ID at service boundaries

```js
const correlationId = req.headers["x-correlation-id"] || `corr-${Date.now()}`;

await axios.post(nextServiceUrl, payload, {
  headers: {
    "x-correlation-id": correlationId,
    "x-user-id": userId,
  },
});
```

4. Use structured logs with context fields

```js
logger.info("Processing request", {
  service: "my-service",
  correlationId,
  userId,
});
```

5. Add service metadata via environment variables

```env
DD_SERVICE=my-service
DD_ENV=demo
DD_VERSION=1.0.0
DD_AGENT_HOST=datadog-agent
DD_TRACE_AGENT_PORT=8126
```

6. Add health endpoint

- Enables fast validation during local testing and CI.

7. Validate propagation

- Trigger one request with a fixed x-correlation-id.
- Confirm all downstream logs include the same ID.
- Confirm Datadog trace shows all services in one waterfall.

## Common issues and fixes

1. No traces visible in Datadog

- Check DD_API_KEY and DD_SITE.
- Ensure datadog-agent container is healthy.
- Wait up to 90 seconds after first requests.

2. Services run but no end-to-end trace

- Confirm tracer is initialized before express/axios imports.
- Confirm inter-service calls use HTTP client libraries that dd-trace instruments.

3. Correlation ID missing in downstream service logs

- Ensure each outbound request forwards x-correlation-id.
- Ensure services read headers with exact key names.

4. Docker compose command mismatch

- Prefer docker compose up --build and docker compose down.
- If your setup only supports legacy command, use docker-compose.

## Useful commands

Start:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

Tail logs:

```bash
docker compose logs -f api-gateway backend-1 backend-2 ai-service db-service
```

## Project structure

```text
.
|- docker-compose.yml
|- .env.example
|- frontend/
|  |- server.js
|  |- tracer.js
|  `- public/index.html
|- api-gateway/
|  |- server.js
|  |- tracer.js
|  `- logger.js
|- backend-1/
|- backend-2/
|- ai-service/
`- db-service/
```

## Screenshots

- Frontend stats: screenshots/screenshot-1-frontend-stats.png
- Successful journey: screenshots/screenshot-2-journey-success.png
- Response payload: screenshots/screenshot-3-response.png
- Datadog map view: screenshots/screenshot-4-datadog-map.png

## Optional alternatives

The same instrumentation pattern can be adapted to other backends:

- OpenTelemetry SDK with Jaeger/Tempo
- New Relic
- ELK plus trace backend

## References

- W3C Trace Context: https://www.w3.org/TR/trace-context/
- Datadog Node.js tracing docs: https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/
- OpenTelemetry JS docs: https://opentelemetry.io/docs/languages/js/
