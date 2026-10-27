CREATE TYPE "public"."project" AS ENUM('receptionist', 'surveillance', 'entertainment', 'navigation', 'back_office');--> statement-breakpoint
CREATE TYPE "public"."robot_model" AS ENUM('agibot_x2', 'agibot_dog');--> statement-breakpoint
CREATE TABLE "robot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"model" "robot_model" NOT NULL,
	"project" "project",
	"profile_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "robot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "project" "project";--> statement-breakpoint
ALTER TABLE "robot" ADD CONSTRAINT "robot_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE set null ON UPDATE no action;