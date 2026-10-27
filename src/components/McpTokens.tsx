"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createApiToken, revokeApiToken } from "@/app/mcp/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TokenRow = { id: string; name: string; prefix: string; created: string; lastUsed: string | null };

export function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? t.mcp.copied : t.mcp.copy}
    </Button>
  );
}

/** The connect guide: create a token, paste the config (with the new token filled in), try it out. */
export function McpGuide({ endpoint }: { endpoint: string }) {
  const t = useT();
  const g = t.mcp.guide;
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const token = fresh ?? "<token>";
  const claudeCode = `claude mcp add --transport http qazbot ${endpoint} --header "Authorization: Bearer ${token}"`;
  const mcpJson = JSON.stringify({ mcpServers: { qazbot: { url: endpoint, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);

  return (
    <ol className="space-y-6">
      <Step n={1} title={g.step1} hint={g.step1Hint}>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            startTransition(async () => {
              setFresh(await createApiToken(name));
              setName("");
            });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={t.mcp.namePlaceholder}
            aria-label={t.mcp.newToken}
            className="max-w-sm flex-1 bg-card"
          />
          <Button disabled={pending || !name.trim()}>
            <KeyRound /> {t.mcp.create}
          </Button>
        </form>
        {fresh && (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-3">
            <p className="text-sm font-medium text-warning">{t.mcp.copyNow}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1.5 font-mono text-xs break-all">{fresh}</code>
              <CopyButton text={fresh} />
            </div>
          </div>
        )}
      </Step>

      <Step n={2} title={g.step2} hint={fresh ? g.step2Filled : g.step2Hint}>
        <Tabs defaultValue="claude">
          <TabsList>
            <TabsTrigger value="claude">{t.mcp.claudeCode}</TabsTrigger>
            <TabsTrigger value="json">{t.mcp.other}</TabsTrigger>
            <TabsTrigger value="url">{t.mcp.endpoint}</TabsTrigger>
          </TabsList>
          <TabsContent value="claude" className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{g.claudeHint}</p>
            <Snippet text={claudeCode} />
          </TabsContent>
          <TabsContent value="json" className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{g.jsonHint}</p>
            <Snippet text={mcpJson} />
          </TabsContent>
          <TabsContent value="url" className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{g.urlHint}</p>
            <Snippet text={endpoint} />
          </TabsContent>
        </Tabs>
      </Step>

      <Step n={3} title={g.step3} hint={g.step3Hint}>
        <Snippet text={g.tryPrompt} />
      </Step>
    </ol>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-gradient text-xs font-semibold text-primary-foreground">{n}</span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
        {children}
      </div>
    </li>
  );
}

function Snippet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-secondary p-2">
      <pre className="min-w-0 flex-1 overflow-x-auto px-1 py-0.5 font-mono text-xs whitespace-pre-wrap break-all">{text}</pre>
      <CopyButton text={text} />
    </div>
  );
}

/** Your MCP access tokens: what each is for, when it was last used, and revoke. */
export function McpTokens({ tokens }: { tokens: TokenRow[] }) {
  const t = useT();
  const [, startTransition] = useTransition();

  return (
    <ul className="divide-y">
      {tokens.map((tok) => (
        <li key={tok.id} className="flex items-center gap-3 px-4 py-2.5">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{tok.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              <code className="font-mono">{tok.prefix}…</code> · {t.mcp.created(tok.created)} ·{" "}
              {tok.lastUsed ? t.mcp.lastUsed(tok.lastUsed) : t.mcp.neverUsed}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => startTransition(() => revokeApiToken(tok.id))}
          >
            <Trash2 /> {t.mcp.revoke}
          </Button>
        </li>
      ))}
      {tokens.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">{t.mcp.none}</li>}
    </ul>
  );
}
