"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { allowedEmails, boards, columns, employeeNotes, invites, profiles, robots, tags } from "@/db/schema";
import { normalizeEmail } from "@/lib/access";
import { track } from "@/lib/activity";
import {
  addCardOp,
  addColumnOp,
  createBoardOp,
  createTagOp,
  deleteBoardOp,
  deleteCardOp,
  id,
  moveCardOp,
  name,
  patchCardOp,
  rescheduleCardOp,
  setCardDatesOp,
  setColumnFlagOp,
  workOnCardOp,
  tagInput,
  updateCardOp,
  type cardUpdate,
} from "@/lib/board-ops";
import { getT } from "@/lib/i18n/server";
import { newInviteToken } from "@/lib/invites";
import { WORK_ROOMS, ROBOT_MODELS } from "@/lib/rooms";
import { assertBoard, assertCard, assertColumn, assertTag, canManageBoard, setBoardMembers } from "@/lib/board-access";
import { requireAdmin, requireUser } from "@/lib/session";

// Dashboard, calendar, timeline and boards all read the same cards.
function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------- Boards ----------

export async function createBoard(formData: FormData) {
  const user = await requireUser();
  await track(user.id, "board.create");
  // Starter columns in the creator's language.
  const boardId = await createBoardOp(user, String(formData.get("name") ?? ""), (await getT()).newBoard.defaultColumns);
  redirect(`/boards/${boardId}`);
}

export async function renameBoard(boardId: string, newName: string) {
  const user = await requireUser();
  await track(user.id, "board.rename");
  await assertBoard(user, boardId);
  await db.update(boards).set({ name: name.parse(newName) }).where(eq(boards.id, id.parse(boardId)));
  refreshAll();
}

export async function deleteBoard(boardId: string) {
  const user = await requireUser();
  await track(user.id, "board.delete");
  await assertBoard(user, boardId);
  if (!(await deleteBoardOp(user, boardId))) return;
  refreshAll();
  redirect("/");
}

/** Board settings: which office room the board works from. Anyone who sees the board may change it. */
export async function setBoardRoom(boardId: string, room: string) {
  const user = await requireUser();
  await track(user.id, "board.settings");
  await assertBoard(user, boardId);
  await db.update(boards).set({ room: z.enum(WORK_ROOMS).parse(room) }).where(eq(boards.id, id.parse(boardId)));
  refreshAll();
}

/** Board settings: who may see the board. Empty opens it to everyone. Creator and admins only. */
export async function setBoardMemberIds(boardId: string, profileIds: string[]) {
  const user = await requireUser();
  await track(user.id, "board.settings");
  const bId = id.parse(boardId);
  if (!(await canManageBoard(user, bId))) throw new Error("Only the board's creator or an admin can change who sees it.");
  await setBoardMembers(bId, z.array(id).max(200).parse(profileIds));
  refreshAll();
}

// ---------- Columns ----------

export async function addColumn(boardId: string, columnName: string) {
  const user = await requireUser();
  await track(user.id, "column.add");
  await assertBoard(user, boardId);
  await addColumnOp(boardId, columnName);
  refreshAll();
}

export async function renameColumn(columnId: string, newName: string) {
  const user = await requireUser();
  await track(user.id, "column.rename");
  await assertColumn(user, columnId);
  const [col] = await db
    .update(columns)
    .set({ name: name.parse(newName) })
    .where(eq(columns.id, id.parse(columnId)))
    .returning({ boardId: columns.boardId });
  if (col) refreshAll();
}

export async function deleteColumn(columnId: string) {
  const user = await requireUser();
  await track(user.id, "column.delete");
  await assertColumn(user, columnId);
  const [col] = await db
    .delete(columns)
    .where(eq(columns.id, id.parse(columnId)))
    .returning({ boardId: columns.boardId });
  if (col) refreshAll();
}

export async function setColumnDone(columnId: string, isDone: boolean) {
  const user = await requireUser();
  await track(user.id, "column.markDone");
  await assertColumn(user, columnId);
  await setColumnFlagOp(columnId, "done", isDone);
  refreshAll();
}

export async function setColumnInProgress(columnId: string, isInProgress: boolean) {
  const user = await requireUser();
  await track(user.id, "column.markInProgress");
  await assertColumn(user, columnId);
  await setColumnFlagOp(columnId, "inProgress", isInProgress);
  refreshAll();
}

export async function moveColumn(columnId: string, toIndex: number) {
  const user = await requireUser();
  await track(user.id, "column.reorder");
  await assertColumn(user, columnId);
  const cId = id.parse(columnId);
  const index = z.number().int().min(0).parse(toIndex);
  const boardId = await db.transaction(async (tx) => {
    const [col] = await tx.select().from(columns).where(eq(columns.id, cId));
    if (!col) return null;
    const others = await tx
      .select({ id: columns.id })
      .from(columns)
      .where(and(eq(columns.boardId, col.boardId), ne(columns.id, cId)))
      .orderBy(asc(columns.position));
    const ordered = others.map((c) => c.id);
    ordered.splice(Math.min(index, ordered.length), 0, cId);
    for (const [position, colId] of ordered.entries()) {
      await tx.update(columns).set({ position }).where(eq(columns.id, colId));
    }
    return col.boardId;
  });
  if (boardId) refreshAll();
}

// ---------- Cards ----------

type QuickFields = Partial<Pick<z.input<typeof cardUpdate>, "dueDate" | "assigneeIds" | "priority">>;

/**
 * Quick add from a column, a calendar day or a timeline row; `dates` pre-fills the schedule and
 * `fields` carries what was picked on the board's draft card (deadline, priority, people).
 */
export async function addCard(columnId: string, title: string, dates?: { startDate?: string | null; dueDate?: string | null }, fields?: QuickFields) {
  const user = await requireUser();
  await track(user.id, "card.add");
  await assertColumn(user, columnId);
  const cardId = await addCardOp(user, columnId, title, dates);
  if (fields) await patchCardOp(cardId, fields);
  refreshAll();
}

/** Timeline drag and resize: set both ends of a card's schedule at once. */
export async function setCardDates(cardId: string, startDate: string | null, dueDate: string | null) {
  const user = await requireUser();
  await track(user.id, "card.timelineDrag");
  await assertCard(user, cardId);
  await setCardDatesOp(cardId, startDate, dueDate);
  refreshAll();
}

export async function updateCard(cardId: string, data: z.input<typeof cardUpdate>) {
  const user = await requireUser();
  await track(user.id, "card.edit");
  await assertCard(user, cardId);
  await updateCardOp(cardId, data);
  refreshAll();
}

/** Calendar drag: move the due date and keep the card's duration by shifting the start date with it. */
export async function rescheduleCard(cardId: string, newDue: string) {
  const user = await requireUser();
  await track(user.id, "card.calendarDrag");
  await assertCard(user, cardId);
  await rescheduleCardOp(cardId, newDue);
  refreshAll();
}

// ---------- Tags ----------

export async function createTag(boardId: string, input: z.input<typeof tagInput>) {
  const user = await requireUser();
  await track(user.id, "tag.create");
  await assertBoard(user, boardId);
  const tag = await createTagOp(boardId, input);
  refreshAll();
  return tag;
}

export async function updateTag(tagId: string, input: z.input<typeof tagInput>) {
  const user = await requireUser();
  await track(user.id, "tag.edit");
  await assertTag(user, tagId);
  await db.update(tags).set(tagInput.parse(input)).where(eq(tags.id, id.parse(tagId)));
  refreshAll();
}

export async function deleteTag(tagId: string) {
  const user = await requireUser();
  await track(user.id, "tag.delete");
  await assertTag(user, tagId);
  await db.delete(tags).where(eq(tags.id, id.parse(tagId)));
  refreshAll();
}

// ---------- Profile ----------

export async function updateMyName(formData: FormData) {
  const user = await requireUser();
  await track(user.id, "profile.rename");
  const displayName = z.string().trim().min(1).max(80).parse(formData.get("name"));
  await db.update(profiles).set({ name: displayName }).where(eq(profiles.id, user.id));
  refreshAll();
}

export async function deleteCard(cardId: string) {
  const user = await requireUser();
  await track(user.id, "card.delete");
  await assertCard(user, cardId);
  if (await deleteCardOp(cardId)) refreshAll();
}

export async function moveCard(cardId: string, toColumnId: string, toIndex: number) {
  const user = await requireUser();
  await track(user.id, "card.move");
  await assertCard(user, cardId);
  await assertColumn(user, toColumnId);
  await moveCardOp(cardId, toColumnId, toIndex);
  refreshAll();
}

/** Board card quick buttons: change only the deadline, assignees or priority. */
export async function quickUpdateCard(cardId: string, patch: QuickFields) {
  const user = await requireUser();
  await track(user.id, "card.quickEdit");
  await assertCard(user, cardId);
  await patchCardOp(cardId, patch);
  refreshAll();
}

/** Workers view: make a queued card the current task. False when its board has no in-progress column. */
export async function workOnCard(cardId: string) {
  const user = await requireUser();
  await track(user.id, "card.workOn");
  await assertCard(user, cardId);
  const ok = await workOnCardOp(cardId);
  if (ok) refreshAll();
  return ok;
}

// ---------- Admin: allowlist ----------

export async function removeAllowedEmail(email: string) {
  const admin = await requireAdmin();
  await track(admin.id, "access.remove");
  const e = normalizeEmail(email);
  if (admin.email === e) {
    throw new Error("You can't remove your own email.");
  }
  await db.delete(allowedEmails).where(eq(allowedEmails.email, e));
  revalidatePath("/admin");
}

/** Make someone an admin or a member again. Admins can't demote themselves, so there's always one left. */
export async function setRole(profileId: string, role: "admin" | "member") {
  const admin = await requireAdmin();
  await track(admin.id, "access.role");
  const { id, value } = z.object({ id: z.string().uuid(), value: z.enum(["admin", "member"]) }).parse({ id: profileId, value: role });
  if (id === admin.id) throw new Error("You can't change your own role.");
  await db.update(profiles).set({ role: value }).where(eq(profiles.id, id));
  revalidatePath("/admin");
}

// ---------- Admin: invite links ----------

/** Create an invite link. Returns the token once; only its hash is stored. */
export async function createInvite(input: { days: number; singleUse: boolean }) {
  const admin = await requireAdmin();
  await track(admin.id, "invite.create");
  const { days, singleUse } = z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30)]), singleUse: z.boolean() }).parse(input);
  const { token, tokenHash, prefix } = newInviteToken();
  await db.insert(invites).values({
    tokenHash,
    prefix,
    createdBy: admin.id,
    maxUses: singleUse ? 1 : null,
    expiresAt: new Date(Date.now() + days * 86_400_000),
  });
  revalidatePath("/admin");
  return token;
}

export async function revokeInvite(inviteId: string) {
  const admin = await requireAdmin();
  await track(admin.id, "invite.revoke");
  await db.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, id.parse(inviteId)));
  revalidatePath("/admin");
}

// ---------- Admin: employee notes ----------

export async function addEmployeeNote(profileId: string, text: string) {
  const admin = await requireAdmin();
  await track(admin.id, "note.add");
  const pId = id.parse(profileId);
  await db.insert(employeeNotes).values({ profileId: pId, authorId: admin.id, text: z.string().trim().min(1).max(5000).parse(text) });
  revalidatePath(`/workers/${pId}`);
}

export async function deleteEmployeeNote(noteId: string) {
  const admin = await requireAdmin();
  await track(admin.id, "note.delete");
  const [note] = await db
    .delete(employeeNotes)
    .where(eq(employeeNotes.id, id.parse(noteId)))
    .returning({ profileId: employeeNotes.profileId });
  if (note) revalidatePath(`/workers/${note.profileId}`);
}

// ---------- Admin: robots ----------

const robotInput = z.object({
  name: z.string().trim().min(1).max(60),
  model: z.enum(ROBOT_MODELS),
  room: z.enum(WORK_ROOMS).nullable(),
  profileId: id.nullable(),
});

export async function addRobot(input: z.input<typeof robotInput>) {
  const admin = await requireAdmin();
  await track(admin.id, "robot.add");
  await db.insert(robots).values(robotInput.parse(input));
  refreshAll();
}

export async function updateRobot(robotId: string, input: z.input<typeof robotInput>) {
  const admin = await requireAdmin();
  await track(admin.id, "robot.edit");
  await db.update(robots).set(robotInput.parse(input)).where(eq(robots.id, id.parse(robotId)));
  refreshAll();
}

export async function deleteRobot(robotId: string) {
  const admin = await requireAdmin();
  await track(admin.id, "robot.delete");
  await db.delete(robots).where(eq(robots.id, id.parse(robotId)));
  refreshAll();
}
