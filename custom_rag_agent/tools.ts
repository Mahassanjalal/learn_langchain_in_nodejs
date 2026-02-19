import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createRetrieverTool } from "langchain/tools/retriever";
import type { Document } from "@langchain/core/documents";

// ---------------------------------------------------------------------------
// 1. Load documents from Lilian Weng's blog
// ---------------------------------------------------------------------------
const urls = [
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/",
  "https://lilianweng.github.io/posts/2023-10-25-adv-attack-llm/",
];

console.log("Loading documents from blog posts...");
const rawDocs = await Promise.all(
  urls.map((url) =>
    new CheerioWebBaseLoader(url, { selector: "p" }).load(),
  ),
);
const docsList: Document[] = rawDocs.flat();
console.log(`Loaded ${docsList.length} documents.`);

// ---------------------------------------------------------------------------
// 2. Split documents into chunks
// ---------------------------------------------------------------------------
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});
const docSplits = await textSplitter.splitDocuments(docsList);
console.log(`Split into ${docSplits.length} chunks.`);

// ---------------------------------------------------------------------------
// 3. Build in-memory vector store with Ollama embeddings
//    Requires: `ollama pull nomic-embed-text`
// ---------------------------------------------------------------------------
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

console.log("Indexing chunks into vector store...");
const vectorStore = await MemoryVectorStore.fromDocuments(docSplits, embeddings);
console.log("Indexing complete.");

// ---------------------------------------------------------------------------
// 4. Create retriever tool
// ---------------------------------------------------------------------------
const retriever = vectorStore.asRetriever();

export const retrieverTool = createRetrieverTool(retriever, {
  name: "retrieve_blog_posts",
  description:
    "Search and return information about Lilian Weng blog posts on LLM agents, prompt engineering, and adversarial attacks on LLMs.",
});

export const tools = [retrieverTool];
