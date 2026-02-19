import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation } from "./state.js";
import { tools } from "./tools.js";
import {
  generateQueryOrRespond,
  shouldRetrieve,
  gradeDocuments,
  rewrite,
  generate,
} from "./nodes.js";

// ---------------------------------------------------------------------------
// Tool node — executes the retriever tool when the LLM makes a tool call
// ---------------------------------------------------------------------------
const toolNode = new ToolNode(tools);

// ---------------------------------------------------------------------------
// Assemble the agentic RAG graph
//
// Flow:
//   START
//     └─► generateQueryOrRespond
//             ├─ (has tool_calls?) ──► retrieve ──► gradeDocuments ─┐
//             │                                          ├─ relevant ► generate ──► END
//             │                                          └─ not relevant ► rewrite ─► generateQueryOrRespond
//             └─ (no tool_calls) ──► END
// ---------------------------------------------------------------------------
const workflow = new StateGraph(GraphAnnotation)
  // Nodes
  .addNode("generateQueryOrRespond", generateQueryOrRespond)
  .addNode("retrieve", toolNode)
  .addNode("rewrite", rewrite)
  .addNode("generate", generate)

  // Entry point
  .addEdge(START, "generateQueryOrRespond")

  // After generateQueryOrRespond: retrieve or finish
  .addConditionalEdges("generateQueryOrRespond", shouldRetrieve, {
    retrieve: "retrieve",
    [END]: END,
  })

  // After retrieve: grade document relevance and route
  .addConditionalEdges("retrieve", gradeDocuments, {
    generate: "generate",
    rewrite: "rewrite",
  })

  // Rewrite loops back to regenerate a new retrieval query
  .addEdge("rewrite", "generateQueryOrRespond")

  // Generate produces the final answer
  .addEdge("generate", END);

export const graph = workflow.compile();

console.log("Custom RAG graph compiled successfully.");
