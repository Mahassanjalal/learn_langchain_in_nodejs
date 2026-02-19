# Node Agentic Work

A collection of **TypeScript** AI agent patterns built with [LangChain.js](https://js.langchain.com/), [LangGraph.js](https://langchain-ai.github.io/langgraphjs/), and **Ollama** (100% local, no API keys required).

Each folder is an independent, runnable agent demonstrating a distinct multi-agent architecture pattern.

---

## Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| [Node.js](https://nodejs.org/) ≥ 18 | Runtime | — |
| [Ollama](https://ollama.com) | Local LLM server | [ollama.com](https://ollama.com) |
| `llama3.2` model | Chat / reasoning | `ollama pull llama3.2` |
| `nomic-embed-text` model | Embeddings (RAG agent only) | `ollama pull nomic-embed-text` |

### Install dependencies

```bash
npm install
```

---

## Project Structure

```
node_agentic_work/
├── rag_agent/                   # RAG agent — document Q&A
│   ├── agent.ts                 # Vector store, retrieval tool, agent
│   └── index.ts                 # Entry point / streaming loop
│
├── supervisor/                  # Supervisor pattern — personal assistant
│   ├── tools.ts                 # Calendar & email stub API tools
│   ├── agents.ts                # Calendar agent, email agent, supervisor
│   └── index.ts                 # Example queries
│
├── support/                     # State machine pattern — customer support
│   ├── state.ts                 # LangGraph Annotation state + step prompts
│   ├── tools.ts                 # State-transition & resolution tools
│   ├── graph.ts                 # StateGraph wiring
│   └── index.ts                 # 3 test scenarios
│
├── router_multiagent_pattern/   # Router pattern — multi-source knowledge base
│   ├── state.ts                 # RouterAnnotation with concat reducer
│   ├── tools.ts                 # GitHub / Notion / Slack stub tools + agents
│   ├── graph.ts                 # StateGraph with Send fan-out
│   └── index.ts                 # 3 example queries
│
├── sql-assistant/               # Progressive disclosure — SQL query assistant
│   ├── skills.ts                # Skill definitions (schemas + business logic)
│   ├── tools.ts                 # load_skill + execute_sql tools
│   ├── agent.ts                 # createReactAgent with skill-aware system prompt
│   └── index.ts                 # 4 test scenarios across 3 verticals
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Agents

### 1. RAG Agent (`rag_agent/`)

**Pattern:** Retrieval-Augmented Generation (RAG)

**What it does:**
Loads a blog post about AI agents from the web, chunks and indexes it into an in-memory vector store, then answers questions using retrieved context.

**Architecture:**

```
User query
  └── retrieve tool → MemoryVectorStore (similarity search)
        └── Top-k chunks returned to the agent
              └── Agent answers using retrieved context
```

**Key components:**

| Component | Detail |
|---|---|
| Document loader | `CheerioWebBaseLoader` (scrapes `<p>` tags) |
| Splitter | `RecursiveCharacterTextSplitter` (1000 chars, 200 overlap) |
| Embeddings | `OllamaEmbeddings` / `nomic-embed-text` |
| Vector store | `MemoryVectorStore` (in-memory, no setup needed) |
| LLM | `ChatOllama` / `llama3.2` |
| Agent | `createReactAgent` from LangGraph |

**Run:**
```bash
npm start
```

---

### 2. Supervisor Agent (`supervisor/`)

**Pattern:** Supervisor / Subagents

**What it does:**
A central supervisor agent coordinates two specialized sub-agents — a **calendar agent** and an **email agent** — to handle complex multi-domain requests like scheduling a meeting and sending an email reminder in a single user query.

**Architecture:**

```
User request
  └── Supervisor Agent
        ├── schedule_event tool → Calendar Agent
        │     ├── create_calendar_event (stub)
        │     └── get_available_time_slots (stub)
        └── manage_email tool → Email Agent
              └── send_email (stub)
```

**Key concepts:**

- Sub-agents are **wrapped as tools** — the supervisor sees `schedule_event` / `manage_email`, not the raw API tools
- Each sub-agent has its own focused system prompt and tool set
- A single user request can trigger both sub-agents in sequence

**Files:**

| File | Responsibility |
|---|---|
| `tools.ts` | 3 typed stub API tools (calendar events, time slots, email) |
| `agents.ts` | Calendar agent, email agent, high-level wrapper tools, supervisor |
| `index.ts` | Example queries (single-domain + multi-domain) |

**Run:**
```bash
npm run start:supervisor
```

---

### 3. Customer Support State Machine (`support/`)

**Pattern:** State Machine with LangGraph

**What it does:**
A customer support agent that progresses through three distinct workflow steps — warranty collection → issue classification → resolution — using LangGraph's `Command` API to drive state transitions via tool calls.

**Workflow:**

```
warranty_collector  →  issue_classifier  →  resolution_specialist
       │                      │                       │
  record_warranty_         record_issue_         provide_solution
  status (Command)         type (Command)        escalate_to_human
                                              go_back_to_warranty
                                            go_back_to_classifier
```

**Key concepts:**

- **State machine via `Annotation`** — `currentStep`, `warrantyStatus`, `issueType` are tracked in graph state
- **Tool-driven transitions** — tools return `Command` objects that update `currentStep` atomically
- **Dynamic prompt selection** — the model node reads `currentStep` and binds only that step's tools on each turn
- **Back-navigation** — the resolution step can return to earlier steps for corrections
- **`MemorySaver`** — state persists across conversation turns per `thread_id`

**Files:**

| File | Responsibility |
|---|---|
| `state.ts` | `SupportAnnotation` + step prompts + TypeScript types |
| `tools.ts` | 6 tools (2 transitions, 2 back-nav, 2 resolution) |
| `graph.ts` | `StateGraph`: `call_model` → `ToolNode` → loop |
| `index.ts` | 3 scenarios: in-warranty, out-of-warranty, correction flow |

**Run:**
```bash
npm run start:support
```

---

### 4. Multi-Source Knowledge Router (`router_multiagent_pattern/`)

**Pattern:** Router with Parallel Execution (Send API)

**What it does:**
A routing agent that classifies a user query, fans out to specialized agents for GitHub, Notion, and Slack knowledge sources **in parallel**, and synthesizes all results into a single coherent answer.

**Architecture:**

```
User query
  └── classify node (LLM with structured output)
        └── routeToAgents() → Send fan-out (parallel)
              ├── github node → GitHub Agent (search_code, search_issues, search_prs)
              ├── notion node → Notion Agent (search_notion, get_page)
              └── slack  node → Slack  Agent (search_slack, get_thread)
                    └── [all results concat-reduced into state.results]
                          └── synthesize node → final answer
```

**Key concepts:**

- **`Send` API** — enables true parallel execution of multiple graph nodes
- **Concat reducer** — `results` accumulates outputs from all parallel branches
- **Selective routing** — LLM uses `withStructuredOutput` + Zod schema to select only relevant verticals (e.g. a code question skips Slack)
- **Targeted sub-questions** — each vertical receives a domain-optimized rephrasing, not the raw user query

**Files:**

| File | Responsibility |
|---|---|
| `state.ts` | `RouterAnnotation` with concat reducer on `results` |
| `tools.ts` | 7 stub tools + 3 `createReactAgent` instances |
| `graph.ts` | `StateGraph`: classify → Send fan-out → vertical nodes → synthesize |
| `index.ts` | 3 example queries exercising different routing combinations |

**Run:**
```bash
npm run start:router_multiagent_pattern
```

---

### 5. SQL Assistant with Progressive Disclosure (`sql-assistant/`)

**Pattern:** Progressive Disclosure / Skills-based Agent

**What it does:**
A SQL query assistant that shows lightweight skill descriptions in its system prompt upfront, then loads the **full database schema and business logic on-demand** via a `load_skill` tool call — only when relevant to the user's query.

**Flow:**

```
System prompt (upfront)
  └── "Available skills: sales_analytics | inventory_management | hr_analytics"

User: "Find customers with >$1000 orders"
  └── Agent calls load_skill("sales_analytics")
        └── Full schema + business rules returned as ToolMessage
              └── Agent writes correct SQL using exact column names & business logic
```

**Skills included:**

| Skill | Tables |
|---|---|
| `sales_analytics` | `customers`, `orders`, `order_items` |
| `inventory_management` | `products`, `warehouses`, `inventory`, `stock_movements` |
| `hr_analytics` | `employees`, `departments`, `salaries`, `performance_reviews` |

**Key concepts:**

- **Progressive disclosure** — full schemas are NOT in the system prompt; they're loaded per-request
- **`MemorySaver` checkpointer** — once a skill is loaded in a thread, it stays in conversation history (no reload needed for follow-ups)
- **`execute_sql` tool** — stub for running validated queries (wire up your DB driver)
- **Easily extensible** — add a new skill by appending to the `SKILLS` array in `skills.ts`

**Files:**

| File | Responsibility |
|---|---|
| `skills.ts` | 3 skill definitions + `buildSkillsPrompt()` helper |
| `tools.ts` | `load_skill` + `execute_sql` tools |
| `agent.ts` | `createReactAgent` with skill-aware system prompt + `MemorySaver` |
| `index.ts` | 4 scenarios: sales, inventory, HR, cross-skill |

**Run:**
```bash
npm run start:sql
```

---

## All npm Scripts

| Script | Agent |
|---|---|
| `npm start` | RAG Agent |
| `npm run start:supervisor` | Supervisor / Personal Assistant |
| `npm run start:support` | Customer Support State Machine |
| `npm run start:router_multiagent_pattern` | Multi-Source Knowledge Router |
| `npm run start:sql` | SQL Assistant |
| `npm run build` | Compile TypeScript → `dist/` |

---

## Tech Stack

| Package | Role |
|---|---|
| `@langchain/core` | Base abstractions (tools, messages, runnables) |
| `@langchain/langgraph` | Graph-based agent orchestration, state management |
| `@langchain/ollama` | Local LLM + embeddings via Ollama |
| `@langchain/community` | Cheerio web loader |
| `@langchain/textsplitters` | Document chunking |
| `langchain` | `MemoryVectorStore`, high-level utilities |
| `cheerio` | HTML parsing for web document loading |
| `zod` | Schema validation and structured LLM output |
| `tsx` | TypeScript execution without a compile step |
| `typescript` | Type safety + IntelliSense |

---

## Pattern Comparison

| Agent | Pattern | Agents | Parallelism | State |
|---|---|---|---|---|
| RAG | Single agent + RAG | 1 | ✗ | In-memory vector store |
| Supervisor | Supervisor + subagents | 3 | Sequential | Stateless (per query) |
| Support | State machine | 1 (multi-step) | ✗ | `MemorySaver` (per thread) |
| Router | Router + parallel specialists | 4 | ✓ (`Send`) | Stateless (per query) |
| SQL Assistant | Progressive disclosure | 1 | ✗ | `MemorySaver` (per thread) |

---

## Adding a New Skill to the SQL Assistant

Open `sql-assistant/skills.ts` and append to the `SKILLS` array:

```typescript
{
  name: "my_new_vertical",
  description: "One-sentence description shown in the system prompt.",
  content: `
# My New Vertical Schema
## Tables
### my_table
- id (PRIMARY KEY)
- ...
## Business Logic
...
  `.trim(),
}
```

No other files need to change — the agent discovers the skill automatically.

---

## License

MIT
