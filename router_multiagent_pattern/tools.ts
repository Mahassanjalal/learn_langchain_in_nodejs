import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared local LLM — `ollama pull llama3.2` before running
// ---------------------------------------------------------------------------
const llm = new ChatOllama({
  model: "llama3.2",
  baseUrl: "http://localhost:11434",
});

// ===========================================================================
// GitHub tools (stub — replace with real Octokit / GitHub REST calls)
// ===========================================================================

export const searchCode = tool(
  async ({ query, repo }: { query: string; repo?: string }): Promise<string> => {
    const r = repo ?? "main";
    return (
      `[GitHub Code] Searched '${query}' in '${r}':\n` +
      `  • src/auth/middleware.ts — Bearer token validation\n` +
      `  • src/auth/jwt.ts — JWT sign / verify helpers\n` +
      `  • src/auth/oauth.ts — OAuth2 authorization code flow`
    );
  },
  {
    name: "search_code",
    description: "Search source code across GitHub repositories.",
    schema: z.object({
      query: z.string().describe("Code search query"),
      repo: z.string().optional().describe("Repository name (default: main)"),
    }),
  }
);

export const searchIssues = tool(
  async ({ query }: { query: string }): Promise<string> => {
    return (
      `[GitHub Issues] Matching '${query}':\n` +
      `  • #142 — Add API auth docs to README (open)\n` +
      `  • #89  — OAuth2 flow broken for mobile clients (closed)\n` +
      `  • #203 — Token refresh not handled gracefully (open)`
    );
  },
  {
    name: "search_issues",
    description: "Search GitHub issues for bug reports and feature requests.",
    schema: z.object({ query: z.string() }),
  }
);

export const searchPrs = tool(
  async ({ query }: { query: string }): Promise<string> => {
    return (
      `[GitHub PRs] Matching '${query}':\n` +
      `  • PR #156 — feat: add JWT authentication middleware (merged)\n` +
      `  • PR #178 — fix: widen OAuth scopes for calendar access (merged)\n` +
      `  • PR #201 — docs: update auth setup guide (open)`
    );
  },
  {
    name: "search_prs",
    description: "Search pull requests for implementation history.",
    schema: z.object({ query: z.string() }),
  }
);

// ===========================================================================
// Notion tools (stub — replace with real Notion API calls)
// ===========================================================================

export const searchNotion = tool(
  async ({ query }: { query: string }): Promise<string> => {
    return (
      `[Notion Search] Results for '${query}':\n` +
      `  • "API Authentication Guide" — OAuth2, API keys, JWT overview\n` +
      `  • "Onboarding: Backend Setup" — includes auth configuration steps\n` +
      `  • "Security Policies" — password & token rotation requirements`
    );
  },
  {
    name: "search_notion",
    description: "Search the Notion workspace for internal documentation.",
    schema: z.object({ query: z.string() }),
  }
);

export const getPage = tool(
  async ({ pageId }: { pageId: string }): Promise<string> => {
    return (
      `[Notion Page ${pageId}]\n` +
      `Title: API Authentication Guide\n` +
      `Content: Step 1 — create an API key in the dashboard.\n` +
      `         Step 2 — pass it as 'Authorization: Bearer <token>'.\n` +
      `         Step 3 — refresh tokens via POST /auth/refresh before expiry.`
    );
  },
  {
    name: "get_page",
    description: "Retrieve the full content of a specific Notion page by its ID.",
    schema: z.object({
      pageId: z.string().describe("The Notion page ID"),
    }),
  }
);

// ===========================================================================
// Slack tools (stub — replace with real Slack Web API calls)
// ===========================================================================

export const searchSlack = tool(
  async ({ query }: { query: string }): Promise<string> => {
    return (
      `[Slack Search] Messages matching '${query}':\n` +
      `  • #engineering (3 days ago) @alice: "Use Bearer tokens; see Notion for the refresh flow"\n` +
      `  • #backend-help (1 week ago) @bob: "Had issues with JWT expiry — PR #156 fixed it"\n` +
      `  • #api-team (2 weeks ago) @carol: "Rate-limit headers are set in the auth middleware"`
    );
  },
  {
    name: "search_slack",
    description: "Search Slack messages and threads for team knowledge.",
    schema: z.object({ query: z.string() }),
  }
);

export const getThread = tool(
  async ({ threadId }: { threadId: string }): Promise<string> => {
    return (
      `[Slack Thread ${threadId}]\n` +
      `Topic: Best practices for API key rotation\n` +
      `Summary: Rotate keys every 90 days, revoke old keys immediately,\n` +
      `         store secrets in AWS Secrets Manager or Vault.`
    );
  },
  {
    name: "get_thread",
    description: "Retrieve the full content of a specific Slack thread.",
    schema: z.object({
      threadId: z.string().describe("The Slack thread ID"),
    }),
  }
);

// ===========================================================================
// Specialized vertical agents (one per knowledge source)
// ===========================================================================

export const githubAgent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: [searchCode, searchIssues, searchPrs],
  messageModifier: `
You are a GitHub expert.
Answer questions about code, API references, and implementation details by
searching repositories, issues, and pull requests.
Always cite the specific file, issue number, or PR you found information in.
  `.trim(),
});

export const notionAgent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: [searchNotion, getPage],
  messageModifier: `
You are a Notion documentation expert.
Answer questions about internal processes, policies, setup guides, and team wikis
by searching the organization's Notion workspace.
Always reference the specific page or section you found information in.
  `.trim(),
});

export const slackAgent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: [searchSlack, getThread],
  messageModifier: `
You are a Slack knowledge expert.
Answer questions by searching relevant threads and discussions where team members
have shared knowledge, solutions, and informal guidance.
Always mention the channel and author when citing information.
  `.trim(),
});
