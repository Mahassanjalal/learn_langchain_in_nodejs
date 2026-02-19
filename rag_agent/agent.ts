import "cheerio";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// Initialize embeddings and in-memory vector store
// Requires Ollama running locally: https://ollama.com
// Pull models first: `ollama pull llama3.2` and `ollama pull nomic-embed-text`
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});
const vectorStore = new MemoryVectorStore(embeddings);

// Load blog content
const pTagSelector = "p";
const cheerioLoader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  { selector: pTagSelector }
);

console.log("Loading documents from blog...");
const docs: Document[] = await cheerioLoader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const allSplits: Document[] = await splitter.splitDocuments(docs);
console.log(`Split into ${allSplits.length} chunks.`);

// Index chunks into the vector store
console.log("Indexing chunks into vector store...");
await vectorStore.addDocuments(allSplits);
console.log("Indexing complete.");

// Define the retrieval tool schema and implementation
const retrieveSchema = z.object({ query: z.string() });

const retrieve = tool(
  async ({ query }: { query: string }): Promise<[string, Document[]]> => {
    const retrievedDocs: Document[] = await vectorStore.similaritySearch(query, 2);
    const serialized: string = retrievedDocs
      .map(
        (doc: Document) =>
          `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
      )
      .join("\n");
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

// Initialize the local Ollama LLM
const llm = new ChatOllama({
  model: "gpt-oss:120b-cloud",
  baseUrl: "http://localhost:11434",
});

const systemMessage = new SystemMessage(
  "You are an assistant for answering questions about Task Decomposition. " +
  "Use the retrieve tool to get relevant information from the blog post when needed."
);

// Create and export the RAG agent
export const agent: ReturnType<typeof createReactAgent> = createReactAgent({
  llm,
  tools: [retrieve],
  messageModifier: systemMessage,
});
