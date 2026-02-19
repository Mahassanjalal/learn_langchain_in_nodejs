import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { StateGraph, END, START, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOllama } from "@langchain/ollama";
import { SupportAnnotation, PROMPTS, type SupportState, type SupportStep } from "./state.js";
import { STEP_TOOLS, ALL_TOOLS } from "./tools.js";

// ---------------------------------------------------------------------------
// Local LLM — make sure Ollama is running with: `ollama pull gpt-oss:120b-cloud`
// ---------------------------------------------------------------------------
const llm = new ChatOllama({
  model: "gpt-oss:120b-cloud",
  baseUrl: "http://localhost:11434",
});

// ---------------------------------------------------------------------------
// Model node — dynamically configures prompt + tools based on currentStep
// ---------------------------------------------------------------------------
async function callModel(state: SupportState): Promise<Partial<SupportState>> {
  const step: SupportStep = state.currentStep ?? "warranty_collector";
  const stepTools = [...STEP_TOOLS[step]];

  // Fill template placeholders ({warrantyStatus}, {issueType})
  let systemPrompt = PROMPTS[step]
    .replace("{warrantyStatus}", state.warrantyStatus ?? "unknown")
    .replace("{issueType}", state.issueType ?? "unknown");

  // Bind only this step's tools so the LLM cannot call out-of-step tools
  const modelWithTools = llm.bindTools(stepTools);

  const response = await modelWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  return { messages: [response] };
}

// ---------------------------------------------------------------------------
// Routing: continue to tools if the LLM made a tool call, otherwise finish
// ---------------------------------------------------------------------------
function shouldContinue(state: SupportState): "tools" | typeof END {
  const last = state.messages.at(-1);
  if (
    last instanceof AIMessage &&
    last.tool_calls !== undefined &&
    last.tool_calls.length > 0
  ) {
    return "tools";
  }
  return END;
}

// ---------------------------------------------------------------------------
// Build the StateGraph
//
// flow:  START → call_model ──(has tool calls?)──► tools ─► call_model …
//                           └──(no tool calls) ──► END
// ---------------------------------------------------------------------------
const toolNode = new ToolNode(ALL_TOOLS);

const workflow = new StateGraph(SupportAnnotation)
  .addNode("call_model", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "call_model")
  .addConditionalEdges("call_model", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "call_model"); // always loop back after tool execution

// Compile with MemorySaver so currentStep persists across conversation turns
const memory = new MemorySaver();
export const supportGraph = workflow.compile({ checkpointer: memory });
