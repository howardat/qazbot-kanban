// Plane's @plane/types for the gantt chart, trimmed to what the timeline uses.

export type TGanttViews = "week" | "month" | "quarter";

export interface WeekMonthDataType {
  key: number;
  shortTitle: string;
  title: string;
  abbreviation: string;
}

export interface ChartDataType {
  key: TGanttViews;
  data: {
    startDate: Date;
    currentDate: Date;
    endDate: Date;
    approxFilterRange: number;
    dayWidth: number;
  };
}

/** Monday first, as the rest of the app (Plane's EStartOfTheWeek). */
export enum EStartOfTheWeek {
  SUNDAY = 0,
  MONDAY = 1,
}

export type BlockPosition = { marginLeft: number; width: number };

/** One card on the chart: its dates (Plane's start_date / target_date) and where its bar sits. */
export interface IGanttBlock {
  id: string;
  start_date: string | null;
  target_date: string | null;
  position?: BlockPosition;
}

export type DragDirection = "left" | "right" | "move";
