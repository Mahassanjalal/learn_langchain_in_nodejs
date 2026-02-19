import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Low-level API tools (stubbed — swap with real API calls in production)
// ---------------------------------------------------------------------------

export const createCalendarEvent = tool(
  async ({
    title,
    startTime,
    endTime,
    attendees,
    location,
  }: {
    title: string;
    startTime: string;
    endTime: string;
    attendees: string[];
    location?: string;
  }): Promise<string> => {
    // Stub: replace with Google Calendar / Outlook API call
    const loc = location ? ` at ${location}` : "";
    return (
      `Event created: "${title}" from ${startTime} to ${endTime}` +
      `${loc} with ${attendees.length} attendee(s).`
    );
  },
  {
    name: "create_calendar_event",
    description:
      "Create a calendar event. Requires exact ISO datetime format (YYYY-MM-DDTHH:MM:SS).",
    schema: z.object({
      title: z.string().describe("Title of the event"),
      startTime: z
        .string()
        .describe("Start time in ISO format, e.g. '2025-03-10T14:00:00'"),
      endTime: z
        .string()
        .describe("End time in ISO format, e.g. '2025-03-10T15:00:00'"),
      attendees: z.array(z.string()).describe("List of attendee email addresses"),
      location: z.string().optional().describe("Optional event location"),
    }),
  }
);

export const getAvailableTimeSlots = tool(
  async ({
    attendees,
    date,
    durationMinutes,
  }: {
    attendees: string[];
    date: string;
    durationMinutes: number;
  }): Promise<string[]> => {
    // Stub: replace with calendar availability API call
    void attendees;
    void date;
    void durationMinutes;
    return ["09:00", "14:00", "16:00"];
  },
  {
    name: "get_available_time_slots",
    description:
      "Check calendar availability for a list of attendees on a specific date.",
    schema: z.object({
      attendees: z.array(z.string()).describe("List of attendee email addresses"),
      date: z.string().describe("Date in ISO format, e.g. '2025-03-10'"),
      durationMinutes: z.number().describe("Desired meeting duration in minutes"),
    }),
  }
);

export const sendEmail = tool(
  async ({
    to,
    subject,
    body,
    cc,
  }: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
  }): Promise<string> => {
    // Stub: replace with SendGrid / Gmail API call
    const ccPart = cc && cc.length > 0 ? ` (cc: ${cc.join(", ")})` : "";
    return `Email sent to ${to.join(", ")}${ccPart} — Subject: "${subject}"`;
  },
  {
    name: "send_email",
    description:
      "Send an email. Requires properly formatted email addresses and a well-written body.",
    schema: z.object({
      to: z.array(z.string()).describe("List of recipient email addresses"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Full email body text"),
      cc: z
        .array(z.string())
        .optional()
        .describe("Optional list of CC email addresses"),
    }),
  }
);
