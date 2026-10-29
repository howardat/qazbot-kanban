-- One board per themed room, the rest share the open office. Production's boards are placed by name
-- (as agreed when rooms stopped being projects); every other board moves to the open office.
UPDATE "board" SET "room" = CASE "name"
  WHEN 'Receptionist' THEN 'receptionist'::"room"
  WHEN 'Qorgan' THEN 'surveillance'::"room"
  WHEN 'Autonomous Worker' THEN 'navigation'::"room"
  WHEN 'Welding Defect Detection' THEN 'welding'::"room"
  ELSE 'back_office'::"room"
END;--> statement-breakpoint
-- Should two boards share one of those names, the oldest keeps the room.
UPDATE "board" SET "room" = 'back_office' WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "room" ORDER BY "created_at", "id") AS n FROM "board" WHERE "room" <> 'back_office'
  ) ranked WHERE n > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "board_room_unique" ON "board" USING btree ("room") WHERE "board"."room" <> 'back_office';
