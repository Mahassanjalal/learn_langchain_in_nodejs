import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// Workflow step names
// ---------------------------------------------------------------------------
export type SupportStep =
  | "warranty_collector"
  | "issue_classifier"
  | "resolution_specialist";

export type WarrantyStatus = "in_warranty" | "out_of_warranty";
export type IssueType = "hardware" | "software";

// ---------------------------------------------------------------------------
// Custom state — extends built-in MessagesAnnotation with domain fields
// ---------------------------------------------------------------------------
export const SupportAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  /** Which step is currently active (drives prompt + tool selection) */
  currentStep: Annotation<SupportStep | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  /** Set after warranty_collector step */
  warrantyStatus: Annotation<WarrantyStatus | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  /** Set after issue_classifier step */
  issueType: Annotation<IssueType | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

export type SupportState = typeof SupportAnnotation.State;

// ---------------------------------------------------------------------------
// System prompts — one per step
// Use {warrantyStatus} / {issueType} as template placeholders
// ---------------------------------------------------------------------------
export const PROMPTS: Record<SupportStep, string> = {
  warranty_collector: `
You are a customer support agent helping with device issues.

CURRENT STAGE: Warranty verification

At this step you need to:
1. Greet the customer warmly.
2. Ask if their device is still under warranty.
3. Use record_warranty_status to record their answer and advance to the next step.

Be conversational and friendly. Ask only one question at a time.
  `.trim(),

  issue_classifier: `
You are a customer support agent helping with device issues.

CURRENT STAGE: Issue classification
CUSTOMER INFO: Warranty status is {warrantyStatus}

At this step you need to:
1. Ask the customer to describe their issue.
2. Determine if it's a HARDWARE issue (physical damage, broken parts) or SOFTWARE issue (app crashes, slow performance, OS bugs).
3. Use record_issue_type to record the classification and advance to the next step.

Ask clarifying questions before classifying if the type is unclear.
  `.trim(),

  resolution_specialist: `
You are a customer support agent helping with device issues.

CURRENT STAGE: Resolution
CUSTOMER INFO: Warranty status is {warrantyStatus}, issue type is {issueType}

At this step you need to:
- SOFTWARE issues → provide troubleshooting steps via provide_solution.
- HARDWARE + IN WARRANTY → explain the warranty repair process via provide_solution.
- HARDWARE + OUT OF WARRANTY → escalate to a human specialist via escalate_to_human.

If the customer says information was wrong use:
- go_back_to_warranty   — to correct warranty status.
- go_back_to_classifier — to correct issue type.

Be specific and helpful.
  `.trim(),
};
