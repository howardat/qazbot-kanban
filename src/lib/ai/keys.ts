import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { decrypt } from "@/lib/secrets";

/**
 * The OpenRouter key for one person's assistant requests. Only their own key: the assistant stays
 * off until they add one. `personal` tells callers to keep it out of the team budget.
 */
export async function openRouterKeyFor(profileId: string): Promise<{ key: string; personal: boolean } | null> {
  const [row] = await db.select({ enc: profiles.openrouterKeyEnc }).from(profiles).where(eq(profiles.id, profileId));
  if (row?.enc) {
    try {
      return { key: decrypt(row.enc), personal: true };
    } catch (e) {
      // A key we can't decrypt (SECRETS_KEY changed) counts as no key, so the person is asked again.
      console.error("personal OpenRouter key unreadable", e);
    }
  }
  return null;
}

/** Whether OpenRouter accepts the key: a cheap call to its key-info endpoint. */
export async function isValidOpenRouterKey(key: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
