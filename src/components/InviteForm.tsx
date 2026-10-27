"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { acceptInvite, type MagicLinkState } from "@/app/auth/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Registration through an invite link: email in, sign-in link out. */
export function InviteForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(acceptInvite.bind(null, token), { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="rounded-2xl border bg-tray p-5 text-center">
        <MailCheck className="mx-auto mb-2 size-6 text-brand" />
        <p className="font-medium">{t.login.checkInbox}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.message} {t.login.linkNote}
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5 rounded-2xl border p-4">
        <Label htmlFor="email">{t.login.email}</Label>
        <Input id="email" name="email" type="email" required autoFocus placeholder="you@company.com" className="h-10 rounded-xl" />
        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      </div>
      <Button size="lg" disabled={pending} className="w-full">
        {pending ? t.login.sending : t.invite.join}
      </Button>
    </form>
  );
}
