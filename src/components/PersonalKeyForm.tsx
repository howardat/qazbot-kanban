"use client";

import { useActionState, useEffect, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { removePersonalKey, removeSonioxKey, savePersonalKey, saveSonioxKey, type KeyState } from "@/app/avatar/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVIDERS = {
  openrouter: { save: savePersonalKey, remove: removePersonalKey, placeholder: "sk-or-v1-…" },
  soniox: { save: saveSonioxKey, remove: removeSonioxKey, placeholder: "Soniox API key" },
};

/**
 * Set, replace or remove your own OpenRouter (default) or Soniox key. The key itself never comes back
 * to the browser. `noKey` replaces the empty-state line, e.g. to say a team key is in use.
 */
export function PersonalKeyForm({
  hint,
  onSaved,
  provider = "openrouter",
  noKey,
}: {
  hint: string | null;
  onSaved?: () => void;
  provider?: keyof typeof PROVIDERS;
  noKey?: string;
}) {
  const t = useT();
  const s = provider === "soniox" ? { ...t.settings, ...t.settings.soniox } : t.settings;
  const p = PROVIDERS[provider];
  const [state, action, pending] = useActionState<KeyState, FormData>(p.save, {});
  const [removing, startRemove] = useTransition();
  useEffect(() => {
    if (state.saved) onSaved?.();
  }, [state, onSaved]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        {hint ? (
          <>
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1">{s.usingYours(hint)}</span>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={removing} onClick={() => startRemove(() => p.remove())}>
              <Trash2 /> {s.remove}
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">{noKey ?? s.noKey}</span>
        )}
      </div>
      <form action={action} className="flex flex-wrap gap-2">
        <Input name="key" type="password" autoComplete="off" required placeholder={p.placeholder} aria-label={s.keyTitle} className="min-w-64 flex-1 font-mono" />
        <Button disabled={pending}>{pending ? s.checking : hint ? s.replace : s.save}</Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.saved && <p className="text-sm text-success">{s.saved}</p>}
    </div>
  );
}
