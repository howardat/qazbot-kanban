// What the MCP tools cost in a model's context: the tool definitions every request carries, and the
// results of the usual look-ups. Run it against the local demo data (pnpm db:seed-demo first):
//
//   pnpm mcp:tokens                      estimate, about 4 characters a token
//   pnpm mcp:tokens --exact              Claude's own count, through OpenRouter (needs OPENROUTER_API_KEY)
//   pnpm mcp:tokens --save before.json   also write the numbers, to compare after a change
//   pnpm mcp:tokens --compare before.json

import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, cards, profiles } from "@/db/schema";
import { createMcpServer } from "@/lib/mcp/server";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? "") : null;
};
const exact = args.includes("--exact");
const MODEL = "anthropic/claude-haiku-4.5";

type Tool = { name: string; description?: string; inputSchema: unknown };

async function openrouter(body: object): Promise<number> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1, ...body }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return (await res.json()).usage.prompt_tokens;
}

// Tokens a text adds to a prompt, over the same prompt with a one-letter message.
const baseline = exact ? await openrouter({ messages: [{ role: "user", content: "x" }] }) : 0;
const countText = async (text: string) =>
  exact ? (await openrouter({ messages: [{ role: "user", content: text }] })) - baseline : Math.ceil(text.length / 4);
const countTools = async (tools: Tool[]) =>
  exact
    ? (await openrouter({
        messages: [{ role: "user", content: "x" }],
        tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
      })) - baseline
    : Math.ceil(JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }))).length / 4);

const [admin] = await db.select().from(profiles).orderBy(asc(profiles.role)).limit(1);
if (!admin) throw new Error("No profiles: sign in once locally and run pnpm db:seed-demo.");
const [busiest] = await db
  .select({ id: boards.id })
  .from(boards)
  .innerJoin(cards, eq(cards.boardId, boards.id))
  .groupBy(boards.id)
  .orderBy(desc(sql`count(*)`))
  .limit(1);

const server = createMcpServer({ actor: { id: admin.id, role: admin.role }, source: "mcp", starterColumns: ["To do", "Doing", "Done"], onChange: () => {} });
const client = new Client({ name: "mcp-tokens", version: "1.0.0" });
const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
await server.connect(serverSide);
await client.connect(clientSide);

const { tools } = await client.listTools();
const rows: [string, number][] = [["tool definitions", await countTools(tools as Tool[])]];

const calls: [string, Record<string, unknown>][] = [
  ["list_boards", {}],
  ["get_board", { boardId: busiest.id }],
  ["list_members", {}],
  ["search_cards", {}],
  ["search_cards", { includeDone: true }],
  ["list_expenses", {}],
  ["expense_summary", {}],
];
for (const [name, a] of calls) {
  const r = await client.callTool({ name, arguments: a });
  const text = (r.content as { text?: string }[]).map((c) => c.text ?? "").join("\n");
  if (r.isError) throw new Error(`${name}: ${text}`);
  rows.push([`${name} ${JSON.stringify(a).replace(/"boardId":"[^"]+"/, '"boardId":…')}`, await countText(text)]);
}
rows.push(["total", rows.reduce((s, [, n]) => s + n, 0)]);
await client.close();

const before = flag("--compare") ? (JSON.parse(readFileSync(flag("--compare")!, "utf8")) as Record<string, number>) : null;
console.log(`${exact ? `Exact (${MODEL})` : "Estimated"} tokens, ${tools.length} tools\n`);
for (const [label, n] of rows) {
  const was = before?.[label];
  const diff = was ? `  was ${was}, ${n - was >= 0 ? "+" : ""}${Math.round(((n - was) / was) * 100)}%` : "";
  console.log(`${label.padEnd(44)} ${String(n).padStart(6)}${diff}`);
}
if (flag("--save")) writeFileSync(flag("--save")!, JSON.stringify(Object.fromEntries(rows), null, 2));
process.exit(0);
