import { routeTask } from "./router.js";
import { runAI } from "../providers/index.js";

export async function executeAgentTask(input) {
  const task = routeTask(input);

  const result = await runAI({
    provider: input.provider || "cloudflare",
    system: task.system,
    user: task.user,
    maxTokens:
      input.maxTokens ||
      (input.type === "content" ? 350 : 500),

    temperature:
      input.temperature || 0.7,
  });

  return {
    success: true,
    type: input.type || "content",
    provider: result.provider,
    model: result.model,
    answer: result.answer,
  };
}
