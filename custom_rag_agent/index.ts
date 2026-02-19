import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph.js";

// ---------------------------------------------------------------------------
// Run the custom RAG agent with a test question
// ---------------------------------------------------------------------------
const question = "What does Lilian Weng say about types of reward hacking?";

console.log("\n=== Custom RAG Agent ===");
console.log(`Question: ${question}\n`);

const inputs = {
  messages: [new HumanMessage(question)],
};

for await (const output of await graph.stream(inputs, { streamMode: "updates" })) {
  for (const [nodeName, nodeOutput] of Object.entries(output)) {
    const messages = (nodeOutput as { messages?: unknown[] }).messages;
    if (!messages || messages.length === 0) continue;

    const lastMsg = messages[messages.length - 1] as {
      _getType: () => string;
      content: unknown;
      tool_calls?: unknown[];
    };

    const type = lastMsg._getType();
    const content =
      typeof lastMsg.content === "string"
        ? lastMsg.content
        : JSON.stringify(lastMsg.content);

    console.log(`--- Node: '${nodeName}' ---`);
    console.log(`Type:    ${type}`);
    if (content) console.log(`Content: ${content}`);
    if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
      console.log(`Tool calls: ${JSON.stringify(lastMsg.tool_calls, null, 2)}`);
    }
    console.log();
  }
}
