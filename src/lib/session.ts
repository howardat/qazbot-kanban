import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isEmailAllowed } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = typeof profiles.$inferSelect;

// TEMPORARY demo bypass: with DEMO_NO_AUTH=1 in dev, act as the first admin profile (or any profile). Remove before shipping.
const demoNoAuth = process.env.DEMO_NO_AUTH === "1" && process.env.NODE_ENV !== "production";

async function demoProfile(): Promise<CurrentUser | null> {
  const [admin] = await db.select().from(profiles).where(eq(profiles.role, "admin")).limit(1);
  if (admin) return admin;
  const [any] = await db.select().from(profiles).limit(1);
  return any ?? null;
}

/** Signed-in, allowed user with profile, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (demoNoAuth) return demoProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  if (!(await isEmailAllowed(user.email))) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  return profile ?? null;
}

/** Use in every page and server action. Re-checks the allowlist so revoking access takes effect immediately. */
export async function requireUser() {
  if (demoNoAuth) {
    const profile = await demoProfile();
    if (profile) return profile;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!(await isEmailAllowed(user.email))) redirect("/login?error=AccessDenied");
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
