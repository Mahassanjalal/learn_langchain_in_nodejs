import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SKILLS } from "./skills.js";

// ---------------------------------------------------------------------------
// Tool 1: load_skill
// Progressive disclosure — the agent calls this to get the full schema for
// a given business vertical. Only loaded when needed, not upfront.
// ---------------------------------------------------------------------------
export const loadSkill = tool(
  async ({ skillName }: { skillName: string }): Promise<string> => {
    const skill = SKILLS.find((s) => s.name === skillName);

    if (skill) {
      return `Skill loaded: **${skill.name}**\n\n${skill.content}`;
    }

    const available = SKILLS.map((s) => s.name).join(", ");
    return (
      `Skill '${skillName}' not found.\n` +
      `Available skills: ${available}\n\n` +
      `Use one of the available skill names exactly as listed.`
    );
  },
  {
    name: "load_skill",
    description:
      "Load the full database schema and business logic for a specific skill vertical. " +
      "Call this before writing any SQL query so you understand the exact table structures, " +
      "column names, and business rules. " +
      "Use the skill name exactly as shown in the Available Skills list.",
    schema: z.object({
      skillName: z
        .string()
        .describe(
          "Exact name of the skill to load, e.g. 'sales_analytics', " +
          "'inventory_management', or 'hr_analytics'"
        ),
    }),
  }
);

// ---------------------------------------------------------------------------
// Tool 2: execute_sql  (stub — replace with real DB driver in production)
// ---------------------------------------------------------------------------
export const executeSql = tool(
  async ({
    query,
    skill,
  }: {
    query: string;
    skill: string;
  }): Promise<string> => {
    // Stub: in production call pg / mysql2 / better-sqlite3 / etc.
    return (
      `[DRY RUN] Executed against the '${skill}' database:\n\n` +
      "```sql\n" +
      query.trim() +
      "\n```\n\n" +
      "(Stub: no real DB connected — wire up your DB driver here)"
    );
  },
  {
    name: "execute_sql",
    description:
      "Execute a SQL query against the production database for the given skill vertical. " +
      "Only call this after loading the skill and confirming the query is correct.",
    schema: z.object({
      query: z
        .string()
        .describe("The SQL query to execute"),
      skill: z
        .string()
        .describe(
          "The skill vertical the query targets, e.g. 'sales_analytics'"
        ),
    }),
  }
);

/** All tools available to the SQL assistant */
export const SQL_TOOLS = [loadSkill, executeSql];
