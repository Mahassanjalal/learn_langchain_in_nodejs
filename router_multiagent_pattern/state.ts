import { Annotation } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One of the three supported knowledge verticals */
export type SourceKey = "github" | "notion" | "slack";

/** A single routing decision: which vertical + its tailored sub-question */
export interface Classification {
  source: SourceKey;
  query: string;
}

/** Result returned by one vertical agent */
export interface AgentResult {
  source: SourceKey;
  result: string;
}

/** Minimal state passed to each vertical node via Send */
export interface AgentInput {
  query: string;
}

// ---------------------------------------------------------------------------
// Main router state
// ---------------------------------------------------------------------------
export const RouterAnnotation = Annotation.Root({
  /** Original user query */
  query: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** Routing decisions produced by the classify node */
  classifications: Annotation<Classification[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Results collected from vertical agents.
   * Uses a concat reducer so parallel Send branches accumulate into one array.
   */
  results: Annotation<AgentResult[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  /** Final synthesized answer */
  finalAnswer: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

export type RouterState = typeof RouterAnnotation.State;
