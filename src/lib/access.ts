import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails, profiles } from "@/db/schema";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function profileCount() {
  const [row] = await db.select({ n: count() }).from(profiles);
  return row.n;
}

/**
 * Sign-in rule:
 * - no profiles yet -> bootstrap: the first person to sign in becomes admin
 * - email on allowlist -> allowed
 * - ALLOWED_DOMAIN set and email in that domain -> allowed
 */
export async function isEmailAllowed(email: string) {
  const e = normalizeEmail(email);
  const domain = process.env.ALLOWED_DOMAIN?.trim().toLowerCase();
  if (domain && e.endsWith(`@${domain}`)) return true;
  const hit = await db.select().from(allowedEmails).where(eq(allowedEmails.email, e)).limit(1);
  if (hit.length > 0) return true;
  return (await profileCount()) === 0;
}

/**
 * Create or refresh the profile for a signed-in user. The very first profile is made admin
 * and put on the allowlist so access survives later rule changes.
 */
export async function upsertProfile(user: { id: string; email: string; name: string | null; image: string | null }) {
  const email = normalizeEmail(user.email);
  const first = (await profileCount()) === 0;
  await db
    .insert(profiles)
    .values({ id: user.id, email, name: user.name, image: user.image, role: first ? "admin" : "member" })
    // Keep a name/avatar the user already has when the sign-in method doesn't provide one (magic link).
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email,
        name: sql`coalesce(${user.name}::text, ${profiles.name})`,
        image: sql`coalesce(${user.image}::text, ${profiles.image})`,
      },
    });
  if (first) await db.insert(allowedEmails).values({ email }).onConflictDoNothing();
}
