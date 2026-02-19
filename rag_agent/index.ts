import { agent } from "./agent.js";
import type { BaseMessage } from "@langchain/core/messages";

const inputMessage = `What is Task Decomposition?`;

const agentInputs = {
  messages: [{ role: "user" as const, content: inputMessage }],
};

for await (const step of await agent.stream(agentInputs, {
  streamMode: "values",
})) {
  const message: BaseMessage = step.messages.at(-1);
  const role: string = message._getType();
  const content: string =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  console.log(`${role}: ${content}`);
}
