import Link from "next/link";
import { redirect } from "next/navigation";
import { SquareKanban, UserPlus } from "lucide-react";
import { InviteForm } from "@/components/InviteForm";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getT } from "@/lib/i18n/server";
import { findUsableInvite } from "@/lib/invites";
import { getCurrentUser } from "@/lib/session";

// Public: someone opening an invite link isn't signed in yet. The invite is checked again when the
// form is sent, so a link that runs out meanwhile is still refused.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (await getCurrentUser()) redirect("/");
  const t = await getT();
  const invite = await findUsableInvite(token);

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
            <UserPlus className="size-5" />
          </span>
        </div>
        <div className="px-8 pt-8 pb-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold">{t.invite.title}</h1>
            {invite && <p className="mt-1.5 text-sm text-muted-foreground">{t.invite.subtitle}</p>}
          </div>
          {invite ? (
            <InviteForm token={token} />
          ) : (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{t.invite.invalid}</p>
          )}
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">
              {t.invite.toLogin}
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
