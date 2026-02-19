import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOllama } from "@langchain/ollama";
import { buildSkillsPrompt } from "./skills.js";
import { SQL_TOOLS } from "./tools.js";

// ---------------------------------------------------------------------------
// Local LLM — make sure Ollama is running with: `ollama pull llama3.2`
// ---------------------------------------------------------------------------
const llm = new ChatOllama({
  model: "gpt-oss:120b-cloud",
  baseUrl: "http://localhost:11434",
});

// ---------------------------------------------------------------------------
// System prompt
//
// The skills section is injected here (progressive disclosure — level 1).
// The agent sees lightweight skill descriptions and knows to call load_skill
// for the full schema before writing any query.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `
You are a SQL query assistant that helps users write accurate, efficient SQL
queries against business databases.

## Instructions

1. When a user asks for a SQL query, identify which skill vertical it belongs to.
2. Call load_skill with the correct skill name to retrieve the full schema and
   business logic BEFORE writing any query.
3. Write the query using only tables and columns that exist in the loaded schema.
4. Follow all business rules defined in the skill (e.g. "only completed orders
   count as revenue", "exclude discontinued products").
5. Always show the final SQL in a fenced \`\`\`sql code block.
6. If asked to run the query, call execute_sql after confirming it is correct.

${buildSkillsPrompt()}
`.trim();

// ---------------------------------------------------------------------------
// Create the SQL assistant agent
// MemorySaver keeps loaded skills in conversation history across turns,
// so the agent doesn't need to reload a skill it already fetched.
// ---------------------------------------------------------------------------
const memory = new MemorySaver();

export const sqlAgent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: SQL_TOOLS,
  messageModifier: SYSTEM_PROMPT,
  checkpointer: memory,
});
