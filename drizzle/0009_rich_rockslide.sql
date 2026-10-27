CREATE TYPE "public"."priority" AS ENUM('urgent', 'high', 'medium', 'low');--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "priority" "priority";