// Projects a card can belong to. Each one is a room on the workers view, so adding a project
// means drawing its room in WorkersScene (and naming it in each i18n dictionary).
export const PROJECTS = ["receptionist", "surveillance", "entertainment", "navigation", "welding", "back_office"] as const;
export type Project = (typeof PROJECTS)[number];

/** Cards without a project are back-office work. */
export const DEFAULT_PROJECT: Project = "back_office";

export const ROBOT_MODELS = ["agibot_x2", "agibot_dog"] as const;
export type RobotModel = (typeof ROBOT_MODELS)[number];
