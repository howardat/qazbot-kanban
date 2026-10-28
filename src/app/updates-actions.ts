"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { LATEST_RELEASE } from "@/lib/updates";
import { requireUser } from "@/lib/session";

/** The signed-in person opened Updates: everything up to the latest release counts as read. */
export async function markUpdatesSeen() {
  const user = await requireUser();
  if (user.updatesSeen === LATEST_RELEASE) return;
  await db.update(profiles).set({ updatesSeen: LATEST_RELEASE }).where(eq(profiles.id, user.id));
}
