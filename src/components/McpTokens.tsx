"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createApiToken, revokeApiToken } from "@/app/mcp/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

/** Create a token (shown once), and list or revoke your existing ones. */
export function McpTokens({ tokens }: { tokens: TokenRow[] }) {
  const t = useT();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
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

      <ul className="divide-y rounded-lg border bg-card">
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
    </div>
  );
}
