import { ChatOllama } from "@langchain/ollama";
import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { z } from "zod";
import {
  RouterAnnotation,
  type RouterState,
  type AgentInput,
  type AgentResult,
  type SourceKey,
} from "./state.js";
import { githubAgent, notionAgent, slackAgent } from "./tools.js";

// ---------------------------------------------------------------------------
// Router LLM (used for classification and synthesis)
// Same Ollama model — swap to a larger one for better routing accuracy
// ---------------------------------------------------------------------------
const routerLlm = new ChatOllama({
  model: "llama3.2",
  baseUrl: "http://localhost:11434",
});

// ---------------------------------------------------------------------------
// Structured output schema for the classifier
// ---------------------------------------------------------------------------
const ClassificationSchema = z.object({
  classifications: z
    .array(
      z.object({
        source: z.enum(["github", "notion", "slack"]),
        query: z.string(),
      })
    )
    .describe(
      "List of knowledge sources to query, each with a targeted sub-question. " +
      "Only include sources that are genuinely relevant."
    ),
});

// ---------------------------------------------------------------------------
// Node 1: classify — determine which verticals to route to
// ---------------------------------------------------------------------------
async function classifyQuery(
  state: RouterState
): Promise<Partial<RouterState>> {
  const structured = routerLlm.withStructuredOutput(ClassificationSchema);

  const result = await structured.invoke([
    {
      role: "system",
      content: `
Analyze the user query and decide which knowledge sources to consult.
For each relevant source generate a targeted sub-question optimized for that domain.

Available sources:
- github : Source code, implementation details, issues, pull requests
- notion : Internal documentation, onboarding guides, policies, wikis
- slack  : Team discussions, informal knowledge sharing, recent conversations

Return ONLY the relevant sources. Omit sources that are unlikely to have useful information.

Example for "How do I authenticate API requests?":
  github → "Search for authentication middleware, JWT handling, and OAuth code"
  notion → "Search for API authentication guide and setup documentation"
  (slack omitted — not relevant for this technical implementation question)
      `.trim(),
    },
    { role: "user", content: state.query },
  ]);

  return {
    classifications: result.classifications as Array<{
      source: SourceKey;
      query: string;
    }>,
  };
}

// ---------------------------------------------------------------------------
// Routing function — fans out to vertical nodes in parallel using Send
// ---------------------------------------------------------------------------
function routeToAgents(state: RouterState): Send[] {
  return state.classifications.map(
    (c) => new Send(c.source, { query: c.query } satisfies AgentInput)
  );
}

// ---------------------------------------------------------------------------
// Helper: extract final text from a createReactAgent result
// ---------------------------------------------------------------------------
function extractText(
  result: Awaited<ReturnType<typeof githubAgent.invoke>>
): string {
  const last = result.messages.at(-1);
  if (!last) return "(no response)";
  return typeof last.content === "string"
    ? last.content
    : JSON.stringify(last.content);
}

// ---------------------------------------------------------------------------
// Node 2a: github — query the GitHub vertical agent
// Receives {query} via Send, returns {results: [...]} which concat-reduces
// ---------------------------------------------------------------------------
async function queryGithub(
  state: AgentInput
): Promise<{ results: AgentResult[] }> {
  const result = await githubAgent.invoke({
    messages: [{ role: "user", content: state.query }],
  });
  return { results: [{ source: "github", result: extractText(result) }] };
}

// ---------------------------------------------------------------------------
// Node 2b: notion — query the Notion vertical agent
// ---------------------------------------------------------------------------
async function queryNotion(
  state: AgentInput
): Promise<{ results: AgentResult[] }> {
  const result = await notionAgent.invoke({
    messages: [{ role: "user", content: state.query }],
  });
  return { results: [{ source: "notion", result: extractText(result) }] };
}

// ---------------------------------------------------------------------------
// Node 2c: slack — query the Slack vertical agent
// ---------------------------------------------------------------------------
async function querySlack(
  state: AgentInput
): Promise<{ results: AgentResult[] }> {
  const result = await slackAgent.invoke({
    messages: [{ role: "user", content: state.query }],
  });
  return { results: [{ source: "slack", result: extractText(result) }] };
}

// ---------------------------------------------------------------------------
// Node 3: synthesize — combine all vertical results into a coherent answer
// ---------------------------------------------------------------------------
async function synthesizeResults(
  state: RouterState
): Promise<Partial<RouterState>> {
  if (state.results.length === 0) {
    return {
      finalAnswer: "No relevant information was found in any knowledge source.",
    };
  }

  const formatted = state.results
    .map(
      (r) =>
        `**${r.source.charAt(0).toUpperCase() + r.source.slice(1)} result:**\n${r.result}`
    )
    .join("\n\n");

  const response = await routerLlm.invoke([
    {
      role: "system",
      content: `
Synthesize the following search results to answer the original question:
"${state.query}"

Guidelines:
- Combine information from all sources without unnecessary repetition.
- Highlight the most relevant and actionable information first.
- Cite the source (GitHub / Notion / Slack) when attributing specific facts.
- Keep the response well-organized and concise.
      `.trim(),
    },
    { role: "user", content: formatted },
  ]);

  const answer =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return { finalAnswer: answer };
}

// ---------------------------------------------------------------------------
// Assemble and compile the StateGraph
//
//  START → classify ──(Send fan-out)──► github ──┐
//                                    ├── notion ──┤ → synthesize → END
//                                    └── slack  ──┘
// ---------------------------------------------------------------------------
export const routerGraph = new StateGraph(RouterAnnotation)
  .addNode("classify", classifyQuery)
  .addNode("github", queryGithub)
  .addNode("notion", queryNotion)
  .addNode("slack", querySlack)
  .addNode("synthesize", synthesizeResults)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", routeToAgents, ["github", "notion", "slack"])
  .addEdge("github", "synthesize")
  .addEdge("notion", "synthesize")
  .addEdge("slack", "synthesize")
  .addEdge("synthesize", END)
  .compile();
