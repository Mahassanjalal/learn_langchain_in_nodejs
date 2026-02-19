import { routerGraph } from "./graph.js";
import type { RouterState } from "./state.js";

// ---------------------------------------------------------------------------
// Utility: run a query through the router and print results
// ---------------------------------------------------------------------------
async function ask(question: string): Promise<void> {
  console.log(`\n${"═".repeat(68)}`);
  console.log(`QUERY: ${question}`);
  console.log("─".repeat(68));

  const result: RouterState = await routerGraph.invoke({ query: question });

  // Show routing decisions
  if (result.classifications.length === 0) {
    console.log("Routing: (no sources selected)");
  } else {
    console.log("Routing:");
    for (const c of result.classifications) {
      console.log(`  [${c.source.padEnd(6)}] ${c.query}`);
    }
  }

  // Show per-source results
  console.log("\nSource results:");
  for (const r of result.results) {
    console.log(`\n  ── ${r.source.toUpperCase()} ──`);
    console.log(r.result.replace(/^/gm, "  "));
  }

  // Final synthesized answer
  console.log(`\n${"─".repeat(68)}`);
  console.log("ANSWER:");
  console.log(result.finalAnswer);
}

// ---------------------------------------------------------------------------
// Example queries — each exercises different routing combinations
// ---------------------------------------------------------------------------

// Technical question → expected: GitHub + Notion
await ask("How do I authenticate API requests?");

// Process/policy question → expected: Notion + Slack
await ask("What is the process for requesting paid time off?");

// Mixed question → expected: all three sources
await ask(
  "What was decided about moving to microservices and where is the implementation?"
);
