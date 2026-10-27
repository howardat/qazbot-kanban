"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/activity";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

/** Remember the viewer's language for a year. Works signed out too (the login page has the switch). */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await track(user.id, "language.change");
  revalidatePath("/", "layout");
}
