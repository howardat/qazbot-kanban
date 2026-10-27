"use client";

import { useActionState, useEffect, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { removePersonalKey, savePersonalKey, type KeyState } from "@/app/avatar/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Set, replace or remove your own OpenRouter key. The key itself never comes back to the browser. */
export function PersonalKeyForm({ hint, onSaved }: { hint: string | null; onSaved?: () => void }) {
  const t = useT();
  const s = t.settings;
  const [state, action, pending] = useActionState<KeyState, FormData>(savePersonalKey, {});
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
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={removing} onClick={() => startRemove(() => removePersonalKey())}>
              <Trash2 /> {s.remove}
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">{s.noKey}</span>
        )}
      </div>
      <form action={action} className="flex flex-wrap gap-2">
        <Input name="key" type="password" autoComplete="off" required placeholder="sk-or-v1-…" aria-label={s.keyTitle} className="min-w-64 flex-1 font-mono" />
        <Button disabled={pending}>{pending ? s.checking : hint ? s.replace : s.save}</Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.saved && <p className="text-sm text-success">{s.saved}</p>}
    </div>
  );
}
