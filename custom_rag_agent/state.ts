import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// Graph state — messages only (all agent flow is coordinated via messages)
// ---------------------------------------------------------------------------
export const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

export type GraphState = typeof GraphAnnotation.State;
