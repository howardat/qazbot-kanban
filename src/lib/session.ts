import { cache } from "react";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { allowedEmails, profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

// Everything about the person except their encrypted OpenRouter key, which only lib/ai/keys reads.
const publicColumns = Object.fromEntries(Object.entries(getTableColumns(profiles)).filter(([k]) => k !== "openrouterKeyEnc")) as Omit<
  ReturnType<typeof getTableColumns<typeof profiles>>,
  "openrouterKeyEnc"
>;
export type CurrentUser = Omit<typeof profiles.$inferSelect, "openrouterKeyEnc">;

// TEMPORARY demo bypass: with DEMO_NO_AUTH=1 in dev, act as the first admin profile (or any profile). Remove before shipping.
const demoNoAuth = process.env.DEMO_NO_AUTH === "1" && process.env.NODE_ENV !== "production";

async function demoProfile(): Promise<CurrentUser | null> {
  const [admin] = await db.select(publicColumns).from(profiles).where(eq(profiles.role, "admin")).limit(1);
  if (admin) return admin;
  const [any] = await db.select(publicColumns).from(profiles).limit(1);
  return any ?? null;
}

type Session = { user: CurrentUser | null; signedIn: boolean };

/**
 * Who is making this request, looked up once per request (the layout and the page share it).
 * getClaims() verifies the session JWT locally, without a round trip to the auth server; the
 * profile and the access check come back in one query. Re-checking access on every request means
 * removing someone from the access list locks them out immediately.
 */
const session = cache(async (): Promise<Session> => {
  if (demoNoAuth) {
    const user = await demoProfile();
    if (user) return { user, signedIn: true };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) return { user: null, signedIn: false };
  const domain = process.env.ALLOWED_DOMAIN?.trim().toLowerCase();
  const [row] = await db
    .select({
      profile: publicColumns,
      allowed: sql<boolean>`exists (select 1 from ${allowedEmails} where ${allowedEmails.email} = ${profiles.email})`,
    })
    .from(profiles)
    .where(eq(profiles.id, id));
  const allowed = !!row && (row.allowed || (!!domain && row.profile.email.endsWith(`@${domain}`)));
  return { user: allowed ? row.profile : null, signedIn: true };
});

/** Signed-in, allowed user with profile, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await session()).user;
}

/** Use in every page and server action. Re-checks the allowlist so revoking access takes effect immediately. */
export async function requireUser() {
  const { user, signedIn } = await session();
  if (!user) redirect(signedIn ? "/login?error=AccessDenied" : "/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
