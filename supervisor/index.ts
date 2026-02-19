import type { BaseMessage } from "@langchain/core/messages";
import { supervisorAgent } from "./agents.js";

// ---------------------------------------------------------------------------
// Utility: stream a query through the supervisor and print each step
// ---------------------------------------------------------------------------
async function runQuery(query: string): Promise<void> {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`USER: ${query}`);
  console.log("─".repeat(70));

  const stream = await supervisorAgent.stream(
    { messages: [{ role: "user" as const, content: query }] },
    { streamMode: "values" }
  );

  for await (const step of stream) {
    const message: BaseMessage = step.messages.at(-1);
    if (!message) continue;

    const role = message._getType();            // "human" | "ai" | "tool"
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content, null, 2);

    if (role === "ai" || role === "tool") {
      console.log(`\n[${role.toUpperCase()}]\n${content}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Example 1: Single-domain — calendar only
// ---------------------------------------------------------------------------
await runQuery("Schedule a team standup for tomorrow at 9am");

// ---------------------------------------------------------------------------
// Example 2: Multi-domain — calendar + email in one request
// ---------------------------------------------------------------------------
await runQuery(
  "Schedule a meeting with the design team next Tuesday at 2pm for 1 hour, " +
  "and send them an email reminder about reviewing the new mockups."
);
