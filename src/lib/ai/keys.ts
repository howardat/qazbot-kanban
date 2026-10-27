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

/**
 * The Soniox key for one person's talk mode: their own if they added one, else the team's
 * SONIOX_API_KEY. Null means talk mode transcribes with OpenRouter.
 */
export async function sonioxKeyFor(profileId: string): Promise<string | null> {
  const [row] = await db.select({ enc: profiles.sonioxKeyEnc }).from(profiles).where(eq(profiles.id, profileId));
  if (row?.enc) {
    try {
      return decrypt(row.enc);
    } catch (e) {
      console.error("personal Soniox key unreadable", e);
    }
  }
  return process.env.SONIOX_API_KEY?.trim() || null;
}

/**
 * Whether Soniox accepts the key for talk mode. Talk mode needs it to mint temporary keys, so that's
 * the check: a one-second, single-use key that's never used.
 */
export async function isValidSonioxKey(key: string) {
  try {
    const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ usage_type: "transcribe_websocket", expires_in_seconds: 1, single_use: true }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
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
