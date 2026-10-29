// Work rooms on the workers view. Each board is mapped to one, and people sit in the room of the
// board holding their latest-assigned in-progress card. Adding a room means drawing it in
// WorkersScene (and naming it in each i18n dictionary under `rooms`).
export const WORK_ROOMS = ["receptionist", "surveillance", "entertainment", "navigation", "welding", "back_office"] as const;
export type WorkRoom = (typeof WORK_ROOMS)[number];

/** New boards work from the back office until someone picks their room. */
export const DEFAULT_ROOM: WorkRoom = "back_office";

export const ROBOT_MODELS = ["agibot_x2", "agibot_dog"] as const;
export type RobotModel = (typeof ROBOT_MODELS)[number];
