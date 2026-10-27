CREATE TABLE "activity_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"kind" text NOT NULL,
	"card_id" uuid,
	"board_id" uuid,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"author_id" uuid,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_note" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "column_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "column" ADD COLUMN "is_in_progress" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_note" ADD CONSTRAINT "employee_note_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_note" ADD CONSTRAINT "employee_note_author_id_profile_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_event_at_idx" ON "activity_event" USING btree ("at");--> statement-breakpoint
CREATE INDEX "activity_event_profile_kind_idx" ON "activity_event" USING btree ("profile_id","kind","at");--> statement-breakpoint
CREATE INDEX "employee_note_profile_idx" ON "employee_note" USING btree ("profile_id");--> statement-breakpoint
-- Backfill: existing cards' last move is unknown, so start from when they were created.
UPDATE "card" SET "column_changed_at" = "created_at";--> statement-breakpoint
-- Starter "In progress" columns on existing boards become in-progress columns.
UPDATE "column" SET "is_in_progress" = true WHERE NOT "is_done" AND lower(trim("name")) IN ('in progress', 'в работе');
