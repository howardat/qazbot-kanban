CREATE TABLE "expense_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_invoice_path_unique" UNIQUE("path")
);
--> statement-breakpoint
ALTER TABLE "expense_invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"vendor" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_invoice" ADD CONSTRAINT "expense_invoice_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_profile_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_invoice_expense_idx" ON "expense_invoice" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_date_idx" ON "expense" USING btree ("date");