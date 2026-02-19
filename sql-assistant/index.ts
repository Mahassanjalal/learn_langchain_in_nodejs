import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { sqlAgent } from "./agent.js";

// ---------------------------------------------------------------------------
// Utility: send a message and print each step of the conversation
// ---------------------------------------------------------------------------
async function ask(
  threadId: string,
  userText: string,
  label: string
): Promise<void> {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`${label}`);
  console.log(`USER: ${userText}`);
  console.log("─".repeat(70));

  const config = { configurable: { thread_id: threadId } };

  const result = await sqlAgent.invoke(
    { messages: [new HumanMessage(userText)] },
    config
  );

  // Print every message produced in this turn (tool calls + AI responses)
  for (const msg of result.messages as BaseMessage[]) {
    const type = msg._getType();
    if (type === "human") continue; // already printed above

    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content, null, 2);

    if (!content.trim()) continue;
    console.log(`\n[${type.toUpperCase()}]\n${content}`);
  }
}

// ===========================================================================
// Scenario A — Sales analytics (single-skill, multi-turn)
// Demonstrates: skill loaded once, reused in follow-up turn
// ===========================================================================
const threadA = "thread-sales-" + Date.now();

await ask(
  threadA,
  "Write a SQL query to find all customers who placed orders over $1,000 in the last month.",
  "=== A1: High-value orders ==="
);

await ask(
  threadA,
  "Now show me the same customers grouped by their customer tier.",
  "=== A2: Follow-up (skill already in context) ==="
);

// ===========================================================================
// Scenario B — Inventory management
// Demonstrates: different skill loaded for a different vertical
// ===========================================================================
const threadB = "thread-inventory-" + Date.now();

await ask(
  threadB,
  "Which products are below their reorder point? Show the top 5 most urgent.",
  "=== B1: Low stock alert ==="
);

// ===========================================================================
// Scenario C — HR analytics
// Demonstrates: third skill vertical; execute_sql called after query is ready
// ===========================================================================
const threadC = "thread-hr-" + Date.now();

await ask(
  threadC,
  "Show me the headcount and average salary for each department, sorted by headcount descending.",
  "=== C1: Department headcount & payroll ==="
);

await ask(
  threadC,
  "Run that query against the database.",
  "=== C2: Execute the query ==="
);

// ===========================================================================
// Scenario D — Cross-skill (agent must load two skills)
// ===========================================================================
const threadD = "thread-cross-" + Date.now();

await ask(
  threadD,
  "Write two queries: one to find gold/platinum customers with more than 5 completed orders, " +
  "and another to find active products that are running low on stock (below reorder point).",
  "=== D1: Cross-skill queries ==="
);
