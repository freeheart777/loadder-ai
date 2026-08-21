import express from "express";
import cors from "cors";

import {
  executeAgentTask,
} from "./ai/agent/executor.js";

const app = express();
const PORT = 3003;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
  })
);

app.use(express.json());

app.get("/api/agent/health", (req, res) => {
  res.json({
    success: true,
    service: "Loadder Agent Gateway",
  });
});

app.post(
  "/api/agent/run",
  async (req, res) => {
    try {
      const result =
        await executeAgentTask(req.body);

      res.json(result);
    } catch (error) {
      console.error(
        "AGENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Agent execution failed.",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log("");
  console.log("🤖 Loadder Agent Gateway");
  console.log(
    `http://localhost:${PORT}`
  );
  console.log("");
});
