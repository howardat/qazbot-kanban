"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { isEmailAllowed, normalizeEmail } from "@/lib/access";
import { consumeInvite } from "@/lib/invites";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const t = await getT();
  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: t.login.invalidEmail };
  const email = parsed.data.toLowerCase();

  // Only send to allowed emails, but answer the same either way so the form doesn't reveal the allowlist.
  if (await isEmailAllowed(email)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      return {
        status: "error",
        message: error.status === 429 ? t.login.tooMany : t.login.sendFailed,
      };
    }
  }
  return { status: "sent", message: t.login.sent(email) };
}

/**
 * Register through an invite link: use up one use of the invite, put the email on the allowlist and
 * send the usual magic link. An email that already has access doesn't use up the invite.
 */
export async function acceptInvite(token: string, _prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const t = await getT();
  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: t.login.invalidEmail };
  const email = normalizeEmail(parsed.data);

  if (!(await isEmailAllowed(email))) {
    if (!(await consumeInvite(token))) return { status: "error", message: t.invite.expired };
    await db.insert(allowedEmails).values({ email }).onConflictDoNothing();
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { status: "error", message: error.status === 429 ? t.login.tooMany : t.login.sendFailed };
  return { status: "sent", message: t.login.sent(email) };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
