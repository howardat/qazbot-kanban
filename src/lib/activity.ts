import "server-only";
import { db } from "@/db";
import { activityEvents } from "@/db/schema";
import { FEATURES, type Feature } from "@/lib/features";

export { FEATURES, type Feature };

/** Finished-card credit for the productivity chart: one row per assignee when a card enters a done column. */
export const CARD_DONE = "card.done";

/**
 * Record that someone used a feature, for the unused-features panel. Never fails the caller:
 * analytics is best effort, so a failed insert is only logged.
 */
export async function track(profileId: string, feature: Feature, ref?: { cardId?: string; boardId?: string }) {
  try {
    await db.insert(activityEvents).values({ profileId, kind: feature, cardId: ref?.cardId, boardId: ref?.boardId });
  } catch (e) {
    console.error("track failed", feature, e);
  }
}
