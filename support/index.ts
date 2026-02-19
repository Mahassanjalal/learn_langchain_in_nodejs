import { HumanMessage } from "@langchain/core/messages";
import { supportGraph } from "./graph.js";
import type { SupportStep } from "./state.js";

// ---------------------------------------------------------------------------
// Utility: send one turn and print the assistant's final reply + active step
// ---------------------------------------------------------------------------
async function chat(
  threadId: string,
  userText: string,
  turnLabel: string
): Promise<void> {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`${turnLabel}`);
  console.log(`USER: ${userText}`);
  console.log("─".repeat(64));

  const config = { configurable: { thread_id: threadId } };

  const result = await supportGraph.invoke(
    { messages: [new HumanMessage(userText)] },
    config
  );

  // Print the assistant's last message
  const lastMsg = result.messages.at(-1);
  const content =
    typeof lastMsg?.content === "string"
      ? lastMsg.content
      : JSON.stringify(lastMsg?.content ?? "");
  console.log(`ASSISTANT: ${content}`);

  // Show active step for debugging
  const step: SupportStep = result.currentStep ?? "warranty_collector";
  console.log(`\n[active step after turn → ${step}]`);
}

// ---------------------------------------------------------------------------
// Scenario A: in-warranty hardware issue → warranty repair
// ---------------------------------------------------------------------------
const threadA = "thread-A-" + Date.now();

await chat(threadA, "Hi, my phone screen is cracked.", "=== Turn 1: Open ticket ===");
await chat(threadA, "Yes, it's still under warranty.", "=== Turn 2: Warranty ===");
await chat(threadA, "The screen is physically cracked — I dropped it.", "=== Turn 3: Issue type ===");
await chat(threadA, "What should I do next?", "=== Turn 4: Get resolution ===");

// ---------------------------------------------------------------------------
// Scenario B: out-of-warranty hardware issue → human escalation
// ---------------------------------------------------------------------------
console.log(`\n\n${"#".repeat(64)}`);
console.log("### SCENARIO B — out-of-warranty hardware (escalation) ###");
console.log("#".repeat(64));

const threadB = "thread-B-" + Date.now();

await chat(threadB, "My laptop won't turn on at all.", "=== Turn 1: Open ticket ===");
await chat(threadB, "No, the warranty expired last year.", "=== Turn 2: Warranty ===");
await chat(threadB, "It's a hardware problem — the power button is stuck.", "=== Turn 3: Issue type ===");
await chat(threadB, "Can you help me fix it?", "=== Turn 4: Get resolution ===");

// ---------------------------------------------------------------------------
// Scenario C: correct wrong information mid-flow
// ---------------------------------------------------------------------------
console.log(`\n\n${"#".repeat(64)}`);
console.log("### SCENARIO C — correction flow (go back) ###");
console.log("#".repeat(64));

const threadC = "thread-C-" + Date.now();

await chat(threadC, "My tablet keeps crashing.", "=== Turn 1: Open ticket ===");
await chat(threadC, "Hmm yes, I think it's under warranty.", "=== Turn 2: Warranty ===");
await chat(threadC, "The apps keep force-closing — it's a software issue.", "=== Turn 3: Issue type ===");
await chat(threadC, "Actually wait, I was wrong — my warranty ended 2 months ago.", "=== Turn 4: Correction ===");
await chat(threadC, "The warranty expired October 2025.", "=== Turn 5: Re-verify ===");
await chat(threadC, "OK so the apps keep freezing.", "=== Turn 6: Re-classify ===");
await chat(threadC, "Please help!", "=== Turn 7: Final resolution ===");
