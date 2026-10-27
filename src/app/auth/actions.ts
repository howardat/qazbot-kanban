"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { isEmailAllowed, normalizeEmail, upsertProfile } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { consumeInvite, refundInvite } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

// Accounts are invite-only and use email + password; nothing is ever emailed. An invite link is the
// only way to register (see register); after that people sign in with signIn.

export type AuthState = { error?: string };

const email = z.string().trim().email();
const password = z.string().min(8).max(72);

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getT();
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.login.wrong };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(parsed.data.email), password: parsed.data.password });
  if (error || !data.user?.email) return { error: error?.status === 429 ? t.login.tooMany : t.login.wrong };
  // Access can be revoked after registering: removed from the list means no way back in.
  if (!(await isEmailAllowed(data.user.email))) {
    await supabase.auth.signOut();
    return { error: t.login.errors.AccessDenied };
  }
  await upsertProfile({ id: data.user.id, email: data.user.email, name: null, image: null });
  redirect("/");
}

/**
 * Register through an invite link: use up one use of the invite, put the email on the access list,
 * create the account and sign in. A failed sign-up gives the invite use back.
 */
export async function register(token: string, _prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getT();
  const parsed = z
    .object({ name: z.string().trim().min(1).max(80), email, password })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "password" ? t.invite.passwordRule : field === "name" ? t.invite.nameRequired : t.login.invalidEmail };
  }
  const address = normalizeEmail(parsed.data.email);
  if (!(await consumeInvite(token))) return { error: t.invite.expired };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: address, password: parsed.data.password, options: { data: { name: parsed.data.name } } });
  if (error || !data.user || !data.session) {
    await refundInvite(token);
    return { error: error?.code === "user_already_exists" ? t.invite.taken : t.invite.failed };
  }
  await db.insert(allowedEmails).values({ email: address }).onConflictDoNothing();
  await upsertProfile({ id: data.user.id, email: address, name: parsed.data.name, image: null });
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
