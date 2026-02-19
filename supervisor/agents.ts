import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import {
  createCalendarEvent,
  getAvailableTimeSlots,
  sendEmail,
} from "./tools.js";

// ---------------------------------------------------------------------------
// Shared local LLM — make sure Ollama is running with: `ollama pull llama3.2`
// ---------------------------------------------------------------------------
const llm = new ChatOllama({
  model: "gpt-oss:120b-cloud",
  baseUrl: "http://localhost:11434",
});

// ---------------------------------------------------------------------------
// Calendar sub-agent
// Understands natural language scheduling → converts to ISO API calls
// ---------------------------------------------------------------------------
const CALENDAR_PROMPT = `
You are a calendar scheduling assistant.
Parse natural language scheduling requests (e.g. "next Tuesday at 2pm")
into proper ISO datetime formats (YYYY-MM-DDTHH:MM:SS).
Use get_available_time_slots to check availability when needed.
Use create_calendar_event to schedule events.
Always confirm what was scheduled in your final response.
`.trim();

const calendarAgent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: [createCalendarEvent, getAvailableTimeSlots],
  messageModifier: CALENDAR_PROMPT,
});

// ---------------------------------------------------------------------------
// Email sub-agent
// Composes and sends professional emails from natural language requests
// ---------------------------------------------------------------------------
const EMAIL_PROMPT = `
You are an email assistant.
Compose professional emails based on natural language requests.
Extract recipient information and craft appropriate subject lines and body text.
Use send_email to send the message.
Always confirm what was sent in your final response.
`.trim();

const emailAgent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: [sendEmail],
  messageModifier: EMAIL_PROMPT,
});

// ---------------------------------------------------------------------------
// Helper: extract the final text reply from an agent result
// ---------------------------------------------------------------------------
function extractFinalText(
  result: Awaited<ReturnType<ReturnType<typeof createReactAgent>["invoke"]>>
): string {
  const last = result.messages.at(-1);
  if (!last) return "";
  return typeof last.content === "string"
    ? last.content
    : JSON.stringify(last.content);
}

// ---------------------------------------------------------------------------
// Wrap sub-agents as high-level tools for the supervisor
// The supervisor only sees "schedule_event" / "manage_email", not the raw APIs
// ---------------------------------------------------------------------------
export const scheduleEvent = tool(
  async ({ request }: { request: string }): Promise<string> => {
    const result = await calendarAgent.invoke({
      messages: [{ role: "user", content: request }],
    });
    return extractFinalText(result);
  },
  {
    name: "schedule_event",
    description: `
Schedule calendar events using natural language.
Use when the user wants to create, modify, or check appointments.
Handles date/time parsing, availability checking, and event creation.
Input: natural language request, e.g. "team meeting next Tuesday at 2pm for 1 hour".
    `.trim(),
    schema: z.object({
      request: z.string().describe("Natural language scheduling request"),
    }),
  }
);

export const manageEmail = tool(
  async ({ request }: { request: string }): Promise<string> => {
    const result = await emailAgent.invoke({
      messages: [{ role: "user", content: request }],
    });
    return extractFinalText(result);
  },
  {
    name: "manage_email",
    description: `
Send emails using natural language.
Use when the user wants to send notifications, reminders, or any email communication.
Handles recipient extraction, subject generation, and body composition.
Input: natural language email request, e.g. "remind the design team about the mockup review".
    `.trim(),
    schema: z.object({
      request: z.string().describe("Natural language email request"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Supervisor agent — routes high-level user requests to the right sub-agent
// ---------------------------------------------------------------------------
const SUPERVISOR_PROMPT = `
You are a helpful personal assistant.
You can schedule calendar events and send emails.
Break user requests into appropriate tool calls and coordinate results.
When a request involves multiple actions, call multiple tools.
`.trim();

export const supervisorAgent: ReturnType<typeof createReactAgent> =
  createReactAgent({
    llm,
    tools: [scheduleEvent, manageEmail],
    messageModifier: SUPERVISOR_PROMPT,
  });
