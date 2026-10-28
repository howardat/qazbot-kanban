import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { PRIORITIES } from "../lib/priority";
import { PROJECTS, ROBOT_MODELS } from "../lib/projects";
import { TAG_COLORS } from "../lib/tag-colors";

export { TAG_COLORS, type TagColor } from "../lib/tag-colors";

// RLS is enabled on every table with no policies: the app reads/writes through DATABASE_URL
// (server only), and Supabase's public Data API (anon/publishable key) gets no access.

// ---------- Users ----------
// Identities live in Supabase's auth.users; this table holds app-level profile data and role.

export const roleEnum = pgEnum("role", ["admin", "member"]);

export const profiles = pgTable("profile", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: roleEnum("role").notNull().default("member"),
  // Index into the preset avatars (components/office/look AVATARS); null means one derived from the id.
  avatar: integer("avatar"),
  // Personal OpenRouter key for this person's assistant requests, encrypted (lib/secrets); the hint
  // is its last characters, so the UI can say which key is set without ever decrypting it.
  openrouterKeyEnc: text("openrouter_key_enc"),
  openrouterKeyHint: text("openrouter_key_hint"),
  // Personal Soniox key for talk mode's speech recognition, stored the same way.
  sonioxKeyEnc: text("soniox_key_enc"),
  sonioxKeyHint: text("soniox_key_hint"),
  // Id of the newest release (lib/updates) this person has opened; anything newer shows the unread dot.
  updatesSeen: text("updates_seen"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

// ---------- Access control ----------

// Emails allowed to sign in. While no profiles exist, the first sign-in becomes admin.
export const allowedEmails = pgTable("allowed_email", {
  email: text("email").primaryKey(),
  addedAt: timestamp("added_at", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

// ---------- Kanban ----------

// Which project (room on the workers view) a card belongs to; null counts as back office.
export const projectEnum = pgEnum("project", PROJECTS);
export const priorityEnum = pgEnum("priority", PRIORITIES);

export const boards = pgTable("board", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

export const columns = pgTable(
  "column",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    // Cards in a "done" column count as finished: not overdue, counted as complete on the dashboard.
    isDone: boolean("is_done").notNull().default(false),
    // Cards in an "in progress" column are someone's current task on the workers view. Never also done.
    isInProgress: boolean("is_in_progress").notNull().default(false),
  },
  (t) => [index("column_board_idx").on(t.boardId)],
).enableRLS();

export const cards = pgTable(
  "card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    position: integer("position").notNull(),
    project: projectEnum("project"),
    priority: priorityEnum("priority"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    // When the card last entered its column: the "last status update" on the workers view.
    columnChangedAt: timestamp("column_changed_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("card_column_idx").on(t.columnId), index("card_board_idx").on(t.boardId)],
).enableRLS();

export const cardAssignees = pgTable(
  "card_assignee",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.profileId] }), index("card_assignee_profile_idx").on(t.profileId)],
).enableRLS();

// Tags are per board, so each team/board keeps its own vocabulary.
export const tagColorEnum = pgEnum("tag_color", TAG_COLORS);

export const tags = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: tagColorEnum("color").notNull().default("sky"),
  },
  (t) => [unique("tag_board_name_uq").on(t.boardId, t.name)],
).enableRLS();

export const cardTags = pgTable(
  "card_tag",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.tagId] }), index("card_tag_tag_idx").on(t.tagId)],
).enableRLS();

// ---------- AI assistant ----------

// One row per OpenRouter request the assistant makes, with its cost, for the usage page.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    // US dollars; numeric keeps sub-cent amounts exact.
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    // Paid with the person's own OpenRouter key: shown in usage, but not counted against the team budget.
    personal: boolean("personal").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt), index("ai_usage_profile_idx").on(t.profileId)],
).enableRLS();

// Saved assistant conversations, private to their owner. `calls` maps each tool call id to the chat's
// one-line summary and status, so a reloaded chat shows what was looked up and what awaits approval.
export const assistantChats = pgTable(
  "assistant_chat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    calls: jsonb("calls").$type<Record<string, { summary: string; status: "done" | "error" | "rejected" | "pending"; destructive?: boolean }>>().notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("assistant_chat_profile_idx").on(t.profileId, t.updatedAt)],
).enableRLS();

// The chat's transcript in pi's message format (user, assistant, toolResult), in order. Append-only.
export const assistantMessages = pgTable(
  "assistant_message",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => assistantChats.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    message: jsonb("message").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.seq] })],
).enableRLS();

// Personal access tokens for the external MCP endpoint (/api/mcp). Only a SHA-256 hash is stored.
export const apiTokens = pgTable(
  "api_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    // First characters of the token, shown in the list so people can tell tokens apart.
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  },
  (t) => [index("api_token_profile_idx").on(t.profileId)],
).enableRLS();

// ---------- Workers ----------

// Append-only log of what people do: feature use (see FEATURES in lib/activity) and finished cards
// ("card.done", one row per assignee) for the productivity chart. Written server-side only.
export const activityEvents = pgTable(
  "activity_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    cardId: uuid("card_id").references(() => cards.id, { onDelete: "set null" }),
    boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
    at: timestamp("at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("activity_event_at_idx").on(t.at), index("activity_event_profile_kind_idx").on(t.profileId, t.kind, t.at)],
).enableRLS();

// Admin-only notes about a person, shown as a log on their worker page.
export const employeeNotes = pgTable(
  "employee_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("employee_note_profile_idx").on(t.profileId)],
).enableRLS();

// Company robots. An assigned robot stands next to its person on the workers view; an unassigned one
// stays in its project's room (or the inventory room without a project).
export const robotModelEnum = pgEnum("robot_model", ROBOT_MODELS);

export const robots = pgTable("robot", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  model: robotModelEnum("model").notNull(),
  project: projectEnum("project"),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

// Invite links admins hand out: opening one lets a new person add their email to the allowlist.
// Only the token's SHA-256 is stored, like api_token. max_uses null means unlimited.
export const invites = pgTable("invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

// ---------- Expenses ----------
// Company expenses in whole tenge. Category is free text: the starter set plus any the team adds.

export const expenses = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    vendor: text("vendor").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("expense_date_idx").on(t.date)],
).enableRLS();

// Invoice files of an expense. The file lives in the private "invoices" Storage bucket under `path`.
export const expenseInvoices = pgTable(
  "expense_invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("expense_invoice_expense_idx").on(t.expenseId)],
).enableRLS();
