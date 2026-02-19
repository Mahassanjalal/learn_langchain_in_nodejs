import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";
import type { GraphState } from "./state.js";
import { tools } from "./tools.js";

// ---------------------------------------------------------------------------
// Local LLM — make sure Ollama is running with the model pulled
// ---------------------------------------------------------------------------
const llm = new ChatOllama({
  model: "gpt-oss:120b-cloud",
  baseUrl: "http://localhost:11434",
});

// ---------------------------------------------------------------------------
// Node 1: generateQueryOrRespond
//
// Binds the retriever tool to the LLM. The model decides whether to call the
// retriever tool (semantic search) or respond directly to the user.
// ---------------------------------------------------------------------------
export async function generateQueryOrRespond(
  state: GraphState,
): Promise<Partial<GraphState>> {
  const modelWithTools = llm.bindTools(tools);
  const response = await modelWithTools.invoke(state.messages);
  return { messages: [response] };
}

// ---------------------------------------------------------------------------
// Conditional edge: shouldRetrieve
//
// After generateQueryOrRespond, check whether the LLM made a tool call.
// If so, route to "retrieve"; otherwise the conversation is done → END.
// ---------------------------------------------------------------------------
export function shouldRetrieve(
  state: GraphState,
): "retrieve" | typeof END {
  const lastMessage = state.messages.at(-1);
  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls !== undefined &&
    lastMessage.tool_calls.length > 0
  ) {
    return "retrieve";
  }
  return END;
}

// ---------------------------------------------------------------------------
// Conditional edge: gradeDocuments  (async — calls the LLM)
//
// Runs after "retrieve". Uses structured output to decide whether retrieved
// docs are relevant to the original question.
// Routes to "generate" (relevant) or "rewrite" (not relevant).
// ---------------------------------------------------------------------------
const gradeSchema = z.object({
  binaryScore: z
    .enum(["yes", "no"])
    .describe("'yes' if the docs are relevant to the question, else 'no'"),
});

const gradePrompt = ChatPromptTemplate.fromTemplate(
  `You are a grader assessing the relevance of retrieved documents to a user question.

Retrieved documents:
-------
{context}
-------

User question: {question}

Give a binary score: 'yes' if the documents are relevant to the question, 'no' if they are not.`,
);

export async function gradeDocuments(
  state: GraphState,
): Promise<"generate" | "rewrite"> {
  const grader = llm.withStructuredOutput(gradeSchema, { name: "gradeDocuments" });

  const question = state.messages.at(0)?.content ?? "";
  const context = state.messages.at(-1)?.content ?? "";

  const score = await gradePrompt
    .pipe(grader)
    .invoke({ question, context });

  console.log(`[gradeDocuments] relevance score: ${score.binaryScore}`);
  return score.binaryScore === "yes" ? "generate" : "rewrite";
}

// ---------------------------------------------------------------------------
// Node 3: rewrite
//
// The retriever returned irrelevant docs. Rewrite the original user question
// to better reflect the underlying semantic intent.
// ---------------------------------------------------------------------------
const rewritePrompt = ChatPromptTemplate.fromTemplate(
  `Look at the input question and reason about its underlying semantic intent.

Initial question:
-------
{question}
-------

Formulate an improved question that will work better for semantic search:`,
);

export async function rewrite(
  state: GraphState,
): Promise<Partial<GraphState>> {
  const question = state.messages.at(0)?.content ?? "";
  const response = await rewritePrompt.pipe(llm).invoke({ question });
  console.log(`[rewrite] improved question: ${response.content}`);
  return { messages: [response] };
}

// ---------------------------------------------------------------------------
// Node 4: generate
//
// Retrieved docs passed the relevance check. Generate a concise final answer
// using the original question and retrieved context.
// ---------------------------------------------------------------------------
const generatePrompt = ChatPromptTemplate.fromTemplate(
  `You are an assistant for question-answering tasks.
Use the following retrieved context to answer the question.
If you don't know the answer, say "I don't know."
Keep the answer concise — three sentences maximum.

Question: {question}
Context: {context}`,
);

export async function generate(
  state: GraphState,
): Promise<Partial<GraphState>> {
  const question = state.messages.at(0)?.content ?? "";
  const context = state.messages.at(-1)?.content ?? "";

  const response = await generatePrompt.pipe(llm).invoke({ question, context });
  return { messages: [response] };
}
