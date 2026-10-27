"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assistantChats } from "@/db/schema";
import { requireUser } from "@/lib/session";

// Chats are private: every write is scoped to the signed-in owner.

export async function renameChat(id: string, title: string) {
  const user = await requireUser();
  const clean = z.string().trim().min(1).max(80).parse(title);
  await db
    .update(assistantChats)
    .set({ title: clean })
    .where(and(eq(assistantChats.id, z.uuid().parse(id)), eq(assistantChats.profileId, user.id)));
  revalidatePath("/assistant", "layout");
}

export async function deleteChat(id: string) {
  const user = await requireUser();
  await db.delete(assistantChats).where(and(eq(assistantChats.id, z.uuid().parse(id)), eq(assistantChats.profileId, user.id)));
  revalidatePath("/assistant", "layout");
}
