"use client";

import { useActionState } from "react";
import { register, type AuthState } from "@/app/auth/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Registration through an invite link: name, email and password in, signed in. */
export function InviteForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(register.bind(null, token), {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t.invite.name}</Label>
          <Input id="name" name="name" autoComplete="name" required autoFocus maxLength={80} className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.login.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.login.password}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="h-10 rounded-xl" />
          <p className="text-xs text-muted-foreground">{t.invite.passwordRule}</p>
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button size="lg" disabled={pending} className="w-full">
        {pending ? t.invite.creating : t.invite.join}
      </Button>
    </form>
  );
}
