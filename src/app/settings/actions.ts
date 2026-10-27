"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { track } from "@/lib/activity";
import { isValidOpenRouterKey } from "@/lib/ai/keys";
import { getT } from "@/lib/i18n/server";
import { encrypt, secretsConfigured } from "@/lib/secrets";
import { requireUser } from "@/lib/session";

export type KeyState = { error?: string; saved?: boolean };

/** Save the signed-in person's own OpenRouter key, after checking OpenRouter accepts it. */
export async function savePersonalKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await requireUser();
  const t = await getT();
  const parsed = z.string().trim().min(20).max(200).safeParse(formData.get("key"));
  if (!parsed.success) return { error: t.settings.invalid };
  if (!secretsConfigured()) return { error: t.settings.notAvailable };
  if (!(await isValidOpenRouterKey(parsed.data))) return { error: t.settings.rejected };
  await db
    .update(profiles)
    .set({ openrouterKeyEnc: encrypt(parsed.data), openrouterKeyHint: parsed.data.slice(-4) })
    .where(eq(profiles.id, user.id));
  await track(user.id, "ai.personalKey");
  revalidatePath("/settings");
  return { saved: true };
}

export async function removePersonalKey() {
  const user = await requireUser();
  await db.update(profiles).set({ openrouterKeyEnc: null, openrouterKeyHint: null }).where(eq(profiles.id, user.id));
  revalidatePath("/settings");
}
