"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { resetPassword } from "@/app/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Admin row action: confirm, set a random new password, then show it once to copy and pass on. */
export function ResetPasswordButton({ profileId, name }: { profileId: string; name: string }) {
  const t = useT();
  const v = t.admin;
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () =>
    startTransition(async () => {
      setError(false);
      try {
        setPassword(await resetPassword(profileId));
      } catch {
        setError(true);
      }
    });

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) return;
        setPassword(null);
        setError(false);
        setCopied(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <KeyRound /> {v.resetPassword}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{v.resetTitle(name)}</DialogTitle>
          <DialogDescription>{password ? v.resetCopyNow : v.resetConfirm}</DialogDescription>
        </DialogHeader>
        {password && (
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-card px-2 py-1.5 text-sm">{password}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(password);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? t.invite.copied : t.invite.copy}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{v.resetFailed}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t.common.close}
            </Button>
          </DialogClose>
          {!password && (
            <Button onClick={reset} disabled={pending}>
              {v.resetDo}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
