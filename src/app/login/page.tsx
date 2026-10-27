import { redirect } from "next/navigation";
import { Mail, SquareKanban } from "lucide-react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LoginForm } from "@/components/LoginForm";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  const t = await getT();

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
            <Mail className="size-5" />
          </span>
        </div>
        <div className="px-8 pt-8 pb-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{t.login.title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.login.subtitle}</p>
          </div>
          {error && (
            <p className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {t.login.errors[error] ?? t.login.errors.fallback}
            </p>
          )}
          <LoginForm />
          <div className="mt-6">
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </main>
  );
}
