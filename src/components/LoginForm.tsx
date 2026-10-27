"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/auth/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.login.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@company.com" className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.login.password}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10 rounded-xl" />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button size="lg" disabled={pending} className="w-full">
        {pending ? t.login.signingIn : t.login.signIn}
      </Button>
    </form>
  );
}
