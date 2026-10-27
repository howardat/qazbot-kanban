import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, profiles } from "@/db/schema";
import { isEmailAllowed } from "@/lib/access";

// Personal access tokens for /api/mcp. Tokens are 32 random bytes; only their SHA-256 is stored, so a
// database leak doesn't leak usable tokens. The "qzb_" prefix makes them easy to spot in secret scanners.

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function newToken() {
  const token = `qzb_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hash(token), prefix: token.slice(0, 10) };
}

/** The profile behind a Bearer token, if the token exists and the person still has access. */
export async function userForToken(token: string) {
  if (!token.startsWith("qzb_")) return null;
  const [row] = await db
    .select({ tokenId: apiTokens.id, profile: profiles })
    .from(apiTokens)
    .innerJoin(profiles, eq(profiles.id, apiTokens.profileId))
    .where(eq(apiTokens.tokenHash, hash(token)));
  if (!row || !(await isEmailAllowed(row.profile.email))) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  return row.profile;
}
