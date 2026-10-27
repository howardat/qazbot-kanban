import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { KeyRound, Plug } from "lucide-react";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { PageHeader, Panel } from "@/components/atoms";
import { CopyButton, McpTokens } from "@/components/McpTokens";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";

export default async function McpPage() {
  const user = await requireUser();
  await track(user.id, "mcp.view");
  const t = await getT();
  const rows = await db.select().from(apiTokens).where(eq(apiTokens.profileId, user.id)).orderBy(desc(apiTokens.createdAt));

  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const endpoint = `${origin}/api/mcp`;
  const claudeCode = `claude mcp add --transport http qazbot ${endpoint} --header "Authorization: Bearer <token>"`;
  const mcpJson = JSON.stringify({ mcpServers: { qazbot: { url: endpoint, headers: { Authorization: "Bearer <token>" } } } }, null, 2);
  const when = (d: Date) => t.fmt.dayYear(d.toISOString().slice(0, 10));

  return (
    <main>
      <PageHeader title={t.mcp.title} description={t.mcp.description} />
      <div className="max-w-3xl space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<KeyRound />} title={t.mcp.yours} bodyClassName="p-4">
          <McpTokens
            tokens={rows.map((r) => ({
              id: r.id,
              name: r.name,
              prefix: r.prefix,
              created: when(r.createdAt),
              lastUsed: r.lastUsedAt ? when(r.lastUsedAt) : null,
            }))}
          />
        </Panel>

        <Panel icon={<Plug />} title={t.mcp.setup} bodyClassName="space-y-4 p-4">
          <Snippet label={t.mcp.endpoint} text={endpoint} />
          <Snippet label={t.mcp.claudeCode} text={claudeCode} />
          <Snippet label={t.mcp.other} text={mcpJson} />
        </Panel>
      </div>
    </main>
  );
}

function Snippet({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto rounded-md border bg-secondary px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">{text}</pre>
    </div>
  );
}
