"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "@/app/auth/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Set your own password: the current one, then the new one twice. */
export function ChangePasswordForm({ email }: { email: string }) {
  const s = useT().settings;
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="max-w-sm space-y-2">
      {/* For password managers: which account this password belongs to. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Input name="current" type="password" autoComplete="current-password" required placeholder={s.currentPassword} aria-label={s.currentPassword} />
      <Input name="next" type="password" autoComplete="new-password" required minLength={8} maxLength={72} placeholder={s.newPassword} aria-label={s.newPassword} />
      <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} placeholder={s.confirmPassword} aria-label={s.confirmPassword} />
      <p className="text-xs text-muted-foreground">{s.passwordRule}</p>
      <Button disabled={pending}>{pending ? s.passwordSaving : s.passwordSave}</Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.saved && <p className="text-sm text-success">{s.passwordSaved}</p>}
    </form>
  );
}
