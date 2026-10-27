ALTER TABLE "ai_usage" ADD COLUMN "personal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "openrouter_key_enc" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "openrouter_key_hint" text;