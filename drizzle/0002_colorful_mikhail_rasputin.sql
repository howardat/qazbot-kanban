ALTER TABLE "card" ADD COLUMN "start_date" date;--> statement-breakpoint
UPDATE "column" SET "is_done" = true WHERE lower("name") = 'done';
