import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import type { SupportState } from "./state.js";

// ---------------------------------------------------------------------------
// Helper: extract tool_call_id injected by ToolNode into RunnableConfig
// ---------------------------------------------------------------------------
function getToolCallId(config: RunnableConfig): string {
  // LangGraph's ToolNode injects toolCallId directly on the config object
  return (config as RunnableConfig & { toolCallId?: string }).toolCallId ?? "";
}

// ---------------------------------------------------------------------------
// State-transition tools (return Command to update graph state)
// ---------------------------------------------------------------------------

/** Step 1 → 2: record warranty status and advance to issue_classifier */
export const recordWarrantyStatus = tool(
  async (
    { status }: { status: "in_warranty" | "out_of_warranty" },
    config: RunnableConfig
  ): Promise<Command<Partial<SupportState>>> => {
    const toolCallId = getToolCallId(config);
    return new Command({
      update: {
        warrantyStatus: status,
        currentStep: "issue_classifier",
        messages: [
          new ToolMessage({
            content: `Warranty status recorded as: ${status}. Moving to issue classification.`,
            tool_call_id: toolCallId,
          }),
        ],
      } as Partial<SupportState>,
    });
  },
  {
    name: "record_warranty_status",
    description:
      "Record the customer's warranty status and advance to the issue classification step.",
    schema: z.object({
      status: z
        .enum(["in_warranty", "out_of_warranty"])
        .describe("Whether the device is under warranty"),
    }),
  }
);

/** Step 2 → 3: record issue type and advance to resolution_specialist */
export const recordIssueType = tool(
  async (
    { issueType }: { issueType: "hardware" | "software" },
    config: RunnableConfig
  ): Promise<Command<Partial<SupportState>>> => {
    const toolCallId = getToolCallId(config);
    return new Command({
      update: {
        issueType,
        currentStep: "resolution_specialist",
        messages: [
          new ToolMessage({
            content: `Issue type recorded as: ${issueType}. Moving to resolution.`,
            tool_call_id: toolCallId,
          }),
        ],
      } as Partial<SupportState>,
    });
  },
  {
    name: "record_issue_type",
    description:
      "Classify the issue as hardware or software and advance to the resolution step.",
    schema: z.object({
      issueType: z
        .enum(["hardware", "software"])
        .describe("The type of issue the customer is experiencing"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Back-navigation tools (correction flow)
// ---------------------------------------------------------------------------

/** Resolution → warranty_collector (user provided wrong warranty info) */
export const goBackToWarranty = tool(
  async (_input: Record<string, never>, config: RunnableConfig): Promise<Command<Partial<SupportState>>> => {
    const toolCallId = getToolCallId(config);
    return new Command({
      update: {
        currentStep: "warranty_collector",
        warrantyStatus: undefined,
        issueType: undefined,
        messages: [
          new ToolMessage({
            content: "Returning to warranty verification to correct the information.",
            tool_call_id: toolCallId,
          }),
        ],
      } as Partial<SupportState>,
    });
  },
  {
    name: "go_back_to_warranty",
    description:
      "Go back to the warranty verification step so the customer can correct that information.",
    schema: z.object({}),
  }
);

/** Resolution → issue_classifier (user provided wrong issue type) */
export const goBackToClassifier = tool(
  async (_input: Record<string, never>, config: RunnableConfig): Promise<Command<Partial<SupportState>>> => {
    const toolCallId = getToolCallId(config);
    return new Command({
      update: {
        currentStep: "issue_classifier",
        issueType: undefined,
        messages: [
          new ToolMessage({
            content: "Returning to issue classification to correct the information.",
            tool_call_id: toolCallId,
          }),
        ],
      } as Partial<SupportState>,
    });
  },
  {
    name: "go_back_to_classifier",
    description:
      "Go back to the issue classification step so the customer can correct the issue type.",
    schema: z.object({}),
  }
);

// ---------------------------------------------------------------------------
// Resolution tools (simple — return a plain string)
// ---------------------------------------------------------------------------

/** Provide a solution or repair instructions to the customer */
export const provideSolution = tool(
  async ({ solution }: { solution: string }): Promise<string> => {
    // Stub: in production, log to CRM, send email, etc.
    return `Solution provided: ${solution}`;
  },
  {
    name: "provide_solution",
    description:
      "Provide troubleshooting steps or warranty repair instructions to the customer.",
    schema: z.object({
      solution: z
        .string()
        .describe("The full solution or repair instructions to share"),
    }),
  }
);

/** Escalate the case to a human agent */
export const escalateToHuman = tool(
  async ({ reason }: { reason: string }): Promise<string> => {
    // Stub: in production, open a ticket, page on-call support, etc.
    return (
      `Case escalated to human support specialist.\n` +
      `Reason: ${reason}\n` +
      `A team member will contact you within 24 hours.`
    );
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate the case to a human specialist (used for out-of-warranty hardware issues).",
    schema: z.object({
      reason: z.string().describe("Brief reason for the escalation"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Step → tools mapping (used by the model node to pick active tools)
// ---------------------------------------------------------------------------
export const STEP_TOOLS = {
  warranty_collector: [recordWarrantyStatus],
  issue_classifier: [recordIssueType],
  resolution_specialist: [provideSolution, escalateToHuman, goBackToWarranty, goBackToClassifier],
} as const;

/** All tools registered with the graph */
export const ALL_TOOLS = [
  recordWarrantyStatus,
  recordIssueType,
  provideSolution,
  escalateToHuman,
  goBackToWarranty,
  goBackToClassifier,
];
