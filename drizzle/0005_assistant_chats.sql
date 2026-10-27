CREATE TABLE "assistant_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"calls" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_chat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assistant_message" (
	"chat_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"message" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_message_chat_id_seq_pk" PRIMARY KEY("chat_id","seq")
);
--> statement-breakpoint
ALTER TABLE "assistant_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assistant_chat" ADD CONSTRAINT "assistant_chat_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_chat_id_assistant_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_chat_profile_idx" ON "assistant_chat" USING btree ("profile_id","updated_at");