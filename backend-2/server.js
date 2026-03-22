require("./tracer");
const express = require("express");
const axios = require("axios");
const logger = require("./logger");

const app = express();
app.use(express.json());

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5003";
const DB_SERVICE_URL = process.env.DB_SERVICE_URL || "http://localhost:5004";

app.post("/process", async (req, res) => {
  const correlationId = req.headers["x-correlation-id"];
  const userId = req.headers["x-user-id"];

  logger.info(
    "Backend-2: Starting business logic — calling AI + DB in parallel",
    {
      correlationId,
      userId,
      service: "backend-2",
    },
  );

  // Call AI and DB in parallel — but handle failures gracefully
  const [aiResult, dbResult] = await Promise.allSettled([
    axios.post(`${AI_SERVICE_URL}/infer`, req.body, {
      headers: { "x-correlation-id": correlationId, "x-user-id": userId },
      timeout: 8000,
    }),
    axios.post(`${DB_SERVICE_URL}/save`, req.body, {
      headers: { "x-correlation-id": correlationId, "x-user-id": userId },
      timeout: 8000,
    }),
  ]);

  const aiSuccess = aiResult.status === "fulfilled";
  const dbSuccess = dbResult.status === "fulfilled";

  // Log what happened
  logger.info("Backend-2: Parallel calls completed", {
    correlationId,
    userId,
    aiSuccess,
    dbSuccess,
    aiError: aiSuccess ? null : aiResult.reason?.message,
    dbError: dbSuccess ? null : dbResult.reason?.message,
    service: "backend-2",
  });

  // Both failed = hard failure
  if (!aiSuccess && !dbSuccess) {
    return res.status(502).json({
      success: false,
      failedAt: "backend-2-both",
      correlationId,
      error: "Both AI and DB services failed",
      aiError: aiResult.reason?.message,
      dbError: dbResult.reason?.message,
    });
  }

  // Partial or full success — return what we have
  res.json({
    success: true,
    correlationId,
    partial: !aiSuccess || !dbSuccess,
    result: {
      aiOutput: aiSuccess
        ? aiResult.value.data
        : { error: aiResult.reason?.message, fallback: true },
      dbOutput: dbSuccess
        ? dbResult.value.data
        : { error: dbResult.reason?.message, fallback: true },
    },
  });
});

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "backend-2" }),
);
app.listen(5002, () => logger.info("Backend-2 running on :5002"));
