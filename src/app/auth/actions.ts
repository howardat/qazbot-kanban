"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { allowedEmails, profiles } from "@/db/schema";
import { isEmailAllowed, normalizeEmail, upsertProfile } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { consumeInvite, refundInvite } from "@/lib/invites";
import { consumeReset, refundReset } from "@/lib/password-resets";
import { track } from "@/lib/activity";
import { adminClient } from "@/lib/supabase/admin";
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

export type PasswordState = { error?: string; saved?: boolean };

/** Change your own password: the current one must check out first, so an unattended session can't. */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const t = await getT();
  const s = t.settings;
  const parsed = z.object({ current: z.string().min(1), next: z.string(), confirm: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: s.passwordWrong };
  const { current, next, confirm } = parsed.data;
  if (!password.safeParse(next).success) return { error: s.passwordRule };
  if (next !== confirm) return { error: s.passwordMismatch };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");
  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: current });
  if (check.error) return { error: check.error.status === 429 ? t.login.tooMany : s.passwordWrong };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: s.passwordFailed };
  await track(data.user.id, "profile.password");
  return { saved: true };
}

export type EmailState = { error?: string; saved?: boolean };

/**
 * Change the email you sign in with. The current password must check out first. Nothing is emailed:
 * the sign-in login, the profile and the access list all move to the new address at once.
 */
export async function changeEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const t = await getT();
  const s = t.settings;
  const parsed = z.object({ email, current: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.login.invalidEmail };
  const next = normalizeEmail(parsed.data.email);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");
  const old = normalizeEmail(data.user.email);
  if (next === old) return { saved: true };
  const check = await supabase.auth.signInWithPassword({ email: old, password: parsed.data.current });
  if (check.error) return { error: check.error.status === 429 ? t.login.tooMany : s.passwordWrong };
  const [taken] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.email, next), ne(profiles.id, data.user.id)));
  if (taken) return { error: s.emailTaken };

  const { error } = await adminClient().auth.admin.updateUserById(data.user.id, { email: next, email_confirm: true });
  if (error) return { error: error.code === "email_exists" ? s.emailTaken : s.emailFailed };
  // Access follows the profile's email, so the new address goes on the list before the old one comes off.
  await db.transaction(async (tx) => {
    await tx.insert(allowedEmails).values({ email: next }).onConflictDoNothing();
    await tx.update(profiles).set({ email: next }).where(eq(profiles.id, data.user.id));
    await tx.delete(allowedEmails).where(eq(allowedEmails.email, old));
  });
  await track(data.user.id, "profile.email");
  // Refresh the session so it carries the new address.
  await supabase.auth.refreshSession();
  revalidatePath("/", "layout");
  return { saved: true };
}

/**
 * Set a new password through a reset link an admin made, then sign in. The link is used up first
 * (so it can't be used twice) and given back if setting the password fails.
 */
export async function completeReset(token: string, _prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const t = await getT();
  const s = t.settings;
  const parsed = z.object({ next: z.string(), confirm: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || !password.safeParse(parsed.data.next).success) return { error: s.passwordRule };
  if (parsed.data.next !== parsed.data.confirm) return { error: s.passwordMismatch };

  const profileId = await consumeReset(token);
  if (!profileId) return { error: t.resetPage.invalid };
  const { data, error } = await adminClient().auth.admin.updateUserById(profileId, { password: parsed.data.next });
  if (error || !data.user.email) {
    await refundReset(token);
    return { error: s.passwordFailed };
  }
  await track(profileId, "profile.password");
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: data.user.email, password: parsed.data.next });
  redirect("/");
}
