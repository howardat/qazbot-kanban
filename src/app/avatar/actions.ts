"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { AVATARS } from "@/components/office/look";
import { track } from "@/lib/activity";
import { isValidOpenRouterKey, isValidSonioxKey } from "@/lib/ai/keys";
import { getT } from "@/lib/i18n/server";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/photo-files";
import { encrypt, secretsConfigured } from "@/lib/secrets";
import { removePhotos, savePhoto } from "@/lib/storage";
import { requireUser } from "@/lib/session";

const AVATAR_COUNT = AVATARS.length;

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
  revalidatePath("/usage");
  return { saved: true };
}

export async function removePersonalKey() {
  const user = await requireUser();
  await db.update(profiles).set({ openrouterKeyEnc: null, openrouterKeyHint: null }).where(eq(profiles.id, user.id));
  revalidatePath("/usage");
}

/** Save the signed-in person's own Soniox key for talk mode, after checking Soniox accepts it. */
export async function saveSonioxKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await requireUser();
  const t = await getT();
  const s = t.settings.soniox;
  const parsed = z.string().trim().min(20).max(400).safeParse(formData.get("key"));
  if (!parsed.success) return { error: s.invalid };
  if (!secretsConfigured()) return { error: t.settings.notAvailable };
  if (!(await isValidSonioxKey(parsed.data))) return { error: s.rejected };
  await db
    .update(profiles)
    .set({ sonioxKeyEnc: encrypt(parsed.data), sonioxKeyHint: parsed.data.slice(-4) })
    .where(eq(profiles.id, user.id));
  await track(user.id, "ai.sonioxKey");
  revalidatePath("/usage");
  return { saved: true };
}

export async function removeSonioxKey() {
  const user = await requireUser();
  await db.update(profiles).set({ sonioxKeyEnc: null, sonioxKeyHint: null }).where(eq(profiles.id, user.id));
  revalidatePath("/usage");
}

/** Pick one of the preset avatars (index into AVATARS), or null to go back to the automatic one. */
export async function setAvatar(index: number | null) {
  const user = await requireUser();
  const avatar = z.number().int().min(0).max(AVATAR_COUNT - 1).nullable().parse(index);
  await db.update(profiles).set({ avatar }).where(eq(profiles.id, user.id));
  await track(user.id, "profile.avatar");
  revalidatePath("/", "layout");
}

export type PhotoState = { error?: string };

/** Upload a profile photo (already cropped and shrunk in the browser); it replaces the earlier one. */
export async function uploadPhoto(formData: FormData): Promise<PhotoState> {
  const user = await requireUser();
  const t = await getT();
  const file = formData.get("photo");
  if (!(file instanceof File) || !PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) return { error: t.settings.photoInvalid };
  try {
    const image = await savePhoto(user.id, file);
    await db.update(profiles).set({ image }).where(eq(profiles.id, user.id));
  } catch (e) {
    console.error("Photo upload failed", e);
    return { error: t.settings.photoFailed };
  }
  await track(user.id, "profile.photo");
  revalidatePath("/", "layout");
  return {};
}

export async function removePhoto() {
  const user = await requireUser();
  await db.update(profiles).set({ image: null }).where(eq(profiles.id, user.id));
  await removePhotos(user.id).catch((e) => console.error("Photo removal failed", e));
  revalidatePath("/", "layout");
}
