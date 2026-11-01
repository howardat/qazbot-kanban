import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, profiles } from "@/db/schema";

// Password reset links: /reset/<token>, made by an admin and passed on by hand (nothing is emailed).
// Tokens are 32 random bytes and only their SHA-256 is stored, so the link is shown once when made.
// The "qzr_" prefix makes them easy to spot in secret scanners.

const PREFIX = "qzr_";
const LIFETIME_MS = 24 * 3_600_000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Still usable: not used yet and not expired. */
const usable = () => and(isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date()));

/** Make a link for someone, replacing any earlier one they haven't used. Returns the token once. */
export async function createReset(profileId: string, createdBy: string) {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  await db.transaction(async (tx) => {
    await tx.delete(passwordResets).where(and(eq(passwordResets.profileId, profileId), isNull(passwordResets.usedAt)));
    await tx.insert(passwordResets).values({ tokenHash: hash(token), profileId, createdBy, expiresAt: new Date(Date.now() + LIFETIME_MS) });
  });
  return token;
}

/** Whose password a usable link is for, or null. */
export async function findUsableReset(token: string) {
  if (!token.startsWith(PREFIX)) return null;
  const [row] = await db
    .select({ profileId: passwordResets.profileId, email: profiles.email, name: profiles.name })
    .from(passwordResets)
    .innerJoin(profiles, eq(profiles.id, passwordResets.profileId))
    .where(and(eq(passwordResets.tokenHash, hash(token)), usable()));
  return row ?? null;
}

/** Use the link up. A single conditional UPDATE, so it can't be used twice. Null if no longer usable. */
export async function consumeReset(token: string) {
  if (!token.startsWith(PREFIX)) return null;
  const [row] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.tokenHash, hash(token)), usable()))
    .returning({ profileId: passwordResets.profileId });
  return row?.profileId ?? null;
}

/** Give the link back when setting the password didn't go through. */
export async function refundReset(token: string) {
  await db.update(passwordResets).set({ usedAt: null }).where(eq(passwordResets.tokenHash, hash(token)));
}
