import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { KeyRound, Plug } from "lucide-react";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { PageHeader, Panel } from "@/components/atoms";
import { McpGuide, McpTokens } from "@/components/McpTokens";
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
  const when = (d: Date) => t.fmt.dayYear(d.toISOString().slice(0, 10));

  return (
    <main>
      <PageHeader title={t.mcp.title} description={t.mcp.description} />
      <div className="max-w-3xl space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<Plug />} title={t.mcp.setup} bodyClassName="p-4">
          <McpGuide endpoint={endpoint} />
        </Panel>

        <Panel icon={<KeyRound />} title={t.mcp.yours}>
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
      </div>
    </main>
  );
}
