import Link from "next/link";
import { KeyRound, SquareKanban } from "lucide-react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ResetForm } from "@/components/ResetForm";
import { getT } from "@/lib/i18n/server";
import { findUsableReset } from "@/lib/password-resets";
import { displayName } from "@/lib/types";

// Public: whoever has the link is signed out, or signed in on someone else's laptop. The link is
// checked again when the form is sent, so one that runs out meanwhile is still refused.
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getT();
  const r = t.resetPage;
  const reset = await findUsableReset(token);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)]">
        <div className="bg-aurora flex h-24 items-center justify-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-white/40 bg-white/25 text-white backdrop-blur-sm">
            <SquareKanban className="size-5" />
          </span>
          <span className="flex gap-1" aria-hidden>
            <span className="size-1.5 rounded-full bg-white/60" />
            <span className="size-1.5 rounded-full bg-white/60" />
            <span className="size-1.5 rounded-full bg-white/60" />
          </span>
          <span className="grid size-11 place-items-center rounded-xl border border-white/40 bg-white/25 text-white backdrop-blur-sm">
            <KeyRound className="size-5" />
          </span>
        </div>
        <div className="px-8 pt-8 pb-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold">{r.title}</h1>
            {reset && <p className="mt-1.5 text-sm text-muted-foreground">{r.subtitle(displayName(reset))}</p>}
          </div>
          {reset ? (
            <ResetForm token={token} email={reset.email} />
          ) : (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{r.invalid}</p>
          )}
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">
              {r.toLogin}
            </Link>
          </p>
          <div className="mt-4 flex justify-center">
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </main>
  );
}
