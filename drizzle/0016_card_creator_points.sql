CREATE TYPE "public"."card_source" AS ENUM('app', 'assistant', 'mcp');--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "story_points" integer;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "created_via" "card_source" DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_created_by_profile_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;