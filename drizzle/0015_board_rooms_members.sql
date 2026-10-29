CREATE TYPE "public"."room" AS ENUM('receptionist', 'surveillance', 'entertainment', 'navigation', 'welding', 'back_office');--> statement-breakpoint
CREATE TABLE "board_member" (
	"board_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	CONSTRAINT "board_member_board_id_profile_id_pk" PRIMARY KEY("board_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "board_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card" ALTER COLUMN "priority" SET DATA TYPE text;--> statement-breakpoint
UPDATE "card" SET "priority" = 'high' WHERE "priority" = 'urgent';--> statement-breakpoint
DROP TYPE "public"."priority";--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
ALTER TABLE "card" ALTER COLUMN "priority" SET DATA TYPE "public"."priority" USING "priority"::"public"."priority";--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "room" "room" DEFAULT 'back_office' NOT NULL;--> statement-breakpoint
ALTER TABLE "card_assignee" ADD COLUMN "assigned_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "robot" ADD COLUMN "room" "room";--> statement-breakpoint
-- Existing assignments date from their card's creation.
UPDATE "card_assignee" SET "assigned_at" = "card"."created_at" FROM "card" WHERE "card"."id" = "card_assignee"."card_id";--> statement-breakpoint
-- Each board's room is the project most of its cards had (ties: alphabetical); boards without one stay back office.
UPDATE "board" SET "room" = picked."project"::text::"room"
FROM (
  SELECT DISTINCT ON ("board_id") "board_id", "project"
  FROM "card" WHERE "project" IS NOT NULL
  GROUP BY "board_id", "project"
  ORDER BY "board_id", count(*) DESC, "project"
) picked
WHERE picked."board_id" = "board"."id";--> statement-breakpoint
UPDATE "robot" SET "room" = "project"::text::"room" WHERE "project" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "board_member" ADD CONSTRAINT "board_member_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_member" ADD CONSTRAINT "board_member_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_member_profile_idx" ON "board_member" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "project";--> statement-breakpoint
ALTER TABLE "robot" DROP COLUMN "project";--> statement-breakpoint
DROP TYPE "public"."project";