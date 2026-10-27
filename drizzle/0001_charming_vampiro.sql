CREATE TYPE "public"."tag_color" AS ENUM('sky', 'gold', 'green', 'red', 'violet', 'orange', 'pink', 'slate');--> statement-breakpoint
CREATE TABLE "card_assignee" (
	"card_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	CONSTRAINT "card_assignee_card_id_profile_id_pk" PRIMARY KEY("card_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "card_assignee" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "card_tag" (
	"card_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "card_tag_card_id_tag_id_pk" PRIMARY KEY("card_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "card_tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" "tag_color" DEFAULT 'sky' NOT NULL,
	CONSTRAINT "tag_board_name_uq" UNIQUE("board_id","name")
);
--> statement-breakpoint
ALTER TABLE "tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card" DROP CONSTRAINT "card_assignee_id_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "column" ADD COLUMN "is_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "card_assignee" ADD CONSTRAINT "card_assignee_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_assignee" ADD CONSTRAINT "card_assignee_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_tag" ADD CONSTRAINT "card_tag_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_tag" ADD CONSTRAINT "card_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_assignee_profile_idx" ON "card_assignee" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "card_tag_tag_idx" ON "card_tag" USING btree ("tag_id");--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "assignee_id";--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "labels";