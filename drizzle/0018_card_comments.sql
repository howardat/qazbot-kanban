CREATE TABLE "card_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "card_comment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_comment" ADD CONSTRAINT "card_comment_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_comment" ADD CONSTRAINT "card_comment_author_id_profile_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_comment_card_idx" ON "card_comment" USING btree ("card_id","created_at");