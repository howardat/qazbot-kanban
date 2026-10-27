"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { createInvite, revokeInvite } from "@/app/actions";
import { Panel } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Invite = { id: string; prefix: string; uses: number; maxUses: number | null; expiresAt: string };
const DAYS = [1, 7, 30] as const;

/** Admin panel for invite links: create one (shown once to copy), list the usable ones, revoke. */
export function InviteManager({ invites }: { invites: Invite[] }) {
  const t = useT();
  const v = t.invite;
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<(typeof DAYS)[number]>(7);
  const [singleUse, setSingleUse] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () =>
    startTransition(async () => {
      const token = await createInvite({ days, singleUse });
      setLink(`${window.location.origin}/invite/${token}`);
      setCopied(false);
    });

  return (
    <Panel icon={<Link2 />} title={v.panel} action={<span className="text-xs tabular-nums">{invites.length}</span>}>
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">{v.panelHint}</p>
      <div className="flex flex-wrap gap-2 border-b p-3">
        <Select value={singleUse ? "single" : "unlimited"} onValueChange={(x) => setSingleUse(x === "single")}>
          <SelectTrigger className="w-40" aria-label={v.singleUse}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">{v.singleUse}</SelectItem>
            <SelectItem value="unlimited">{v.unlimited}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(x) => setDays(Number(x) as (typeof DAYS)[number])}>
          <SelectTrigger className="w-48" aria-label={v.days(days)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {v.days(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={create} disabled={pending}>
          {v.create}
        </Button>
      </div>
      {link && (
        <div className="space-y-1.5 border-b bg-primary/5 p-3">
          <p className="text-xs font-medium">{v.copyNow}</p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-card px-2 py-1.5 text-xs">{link}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? v.copied : v.copy}
            </Button>
          </div>
        </div>
      )}
      {invites.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{v.none}</p>
      ) : (
        <ul className="divide-y">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <code className="text-xs text-muted-foreground">{i.prefix}…</code>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {v.uses(i.uses, i.maxUses)} · {v.expires(t.fmt.stamp(i.expiresAt))}
              </span>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => startTransition(() => revokeInvite(i.id))}>
                <Trash2 /> {v.revoke}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
