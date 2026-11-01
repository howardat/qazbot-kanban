"use client";

import { useActionState } from "react";
import { completeReset, type PasswordState } from "@/app/auth/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The new password, twice; saving signs in. */
export function ResetForm({ token, email }: { token: string; email: string }) {
  const t = useT();
  const r = t.resetPage;
  const [state, action, pending] = useActionState<PasswordState, FormData>(completeReset.bind(null, token), {});
  return (
    <form action={action} className="space-y-4">
      {/* For password managers: which account this password belongs to. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="next">{r.newPassword}</Label>
          <Input id="next" name="next" type="password" autoComplete="new-password" required autoFocus minLength={8} maxLength={72} className="h-10 rounded-xl" />
          <p className="text-xs text-muted-foreground">{t.settings.passwordRule}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{r.confirm}</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="h-10 rounded-xl" />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button size="lg" disabled={pending} className="w-full">
        {pending ? r.saving : r.save}
      </Button>
    </form>
  );
}
