import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { invites } from "@/db/schema";

// Invite links: /invite/<token>. Tokens are 32 random bytes and only their SHA-256 is stored, so the
// link is shown once when created. The "qzi_" prefix makes them easy to spot in secret scanners.

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function newInviteToken() {
  const token = `qzi_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hash(token), prefix: token.slice(0, 10) };
}

/** Still usable: not revoked, not expired, uses left. */
const usable = () =>
  and(
    isNull(invites.revokedAt),
    gt(invites.expiresAt, new Date()),
    or(isNull(invites.maxUses), lt(invites.uses, invites.maxUses)),
  );

export async function findUsableInvite(token: string) {
  if (!token.startsWith("qzi_")) return null;
  const [row] = await db.select().from(invites).where(and(eq(invites.tokenHash, hash(token)), usable()));
  return row ?? null;
}

/**
 * Use up one use of an invite. A single conditional UPDATE, so two people racing for the last use
 * can't both get it. False if the invite is no longer usable.
 */
export async function consumeInvite(token: string) {
  if (!token.startsWith("qzi_")) return false;
  const rows = await db
    .update(invites)
    .set({ uses: sql`${invites.uses} + 1` })
    .where(and(eq(invites.tokenHash, hash(token)), usable()))
    .returning({ id: invites.id });
  return rows.length > 0;
}

/** Invites admins still need to see: usable ones, newest first. */
export async function loadActiveInvites() {
  return db.select().from(invites).where(usable()).orderBy(desc(invites.createdAt));
}
