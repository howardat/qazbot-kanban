"use client";

import { useActionState } from "react";
import { changeEmail, type EmailState } from "@/app/auth/actions";
import { saveDetails, type DetailsState } from "@/app/profile/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Your full name. */
export function DetailsForm({ name }: { name: string | null }) {
  const s = useT().settings;
  const [state, action, pending] = useActionState<DetailsState, FormData>(saveDetails, {});
  return (
    <form action={action} className="max-w-sm space-y-3">
      <Field id="profile-name" label={s.fullName}>
        <Input id="profile-name" name="name" defaultValue={name ?? ""} required maxLength={80} autoComplete="name" />
      </Field>
      <Button disabled={pending}>{pending ? s.detailsSaving : s.detailsSave}</Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.saved && <p className="text-sm text-success">{s.detailsSaved}</p>}
    </form>
  );
}

/** A new sign-in email, confirmed with the current password. */
export function EmailForm({ email }: { email: string }) {
  const s = useT().settings;
  const [state, action, pending] = useActionState<EmailState, FormData>(changeEmail, {});
  return (
    <form action={action} className="max-w-sm space-y-3">
      <Field id="profile-email" label={s.newEmail}>
        <Input id="profile-email" name="email" type="email" defaultValue={email} required autoComplete="email" />
      </Field>
      <Field id="profile-email-password" label={s.currentPassword}>
        <Input id="profile-email-password" name="current" type="password" required autoComplete="current-password" />
      </Field>
      <Button disabled={pending}>{pending ? s.detailsSaving : s.emailSave}</Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.saved && <p className="text-sm text-success">{s.emailSaved}</p>}
    </form>
  );
}
