"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { newToken } from "@/lib/mcp/tokens";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";

/** Create a personal MCP token. The plain token is returned once and never stored. */
export async function createApiToken(name: string) {
  const user = await requireUser();
  await track(user.id, "mcp.tokenCreate");
  const label = z.string().trim().min(1).max(80).parse(name);
  const { token, tokenHash, prefix } = newToken();
  await db.insert(apiTokens).values({ profileId: user.id, name: label, tokenHash, prefix });
  revalidatePath("/mcp");
  return token;
}

/** Revoke one of your own tokens; clients using it stop working on their next request. */
export async function revokeApiToken(tokenId: string) {
  const user = await requireUser();
  await db.delete(apiTokens).where(and(eq(apiTokens.id, z.string().uuid().parse(tokenId)), eq(apiTokens.profileId, user.id)));
  revalidatePath("/mcp");
}
