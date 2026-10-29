// Work rooms on the workers view: places in the office, one board each. A room shows the name of the
// board in it, and people sit in the room of the board holding their latest-assigned in-progress
// card. The ids name the room's furniture, not a project. Adding a room means drawing it in
// WorkersScene (and naming the place in each i18n dictionary under `rooms`).
export const WORK_ROOMS = ["receptionist", "surveillance", "entertainment", "navigation", "welding", "back_office"] as const;
export type WorkRoom = (typeof WORK_ROOMS)[number];

export const ROBOT_MODELS = ["agibot_x2", "agibot_dog"] as const;
export type RobotModel = (typeof ROBOT_MODELS)[number];
