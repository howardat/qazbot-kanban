"use client";

// Stands in for Plane's MobX timeline store (useTimeLineChartStore): what the chart's parts share.
import { createContext, useContext } from "react";
import type { BlockPosition, ChartDataType, TGanttViews } from "./types";

export type TimelineChartStore = {
  currentView: TGanttViews;
  currentViewData: ChartDataType;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  /** Live bar position while it's dragged, before the new dates are saved. */
  updateBlockPosition: (id: string, position: BlockPosition) => void;
  getDateFromPositionOnGantt: (position: number, offsetDays: number) => Date;
  getNumberOfDaysFromPosition: (position: number | undefined) => number | undefined;
};

export const TimelineChartContext = createContext<TimelineChartStore | null>(null);

export function useTimeLineChartStore() {
  const store = useContext(TimelineChartContext);
  if (!store) throw new Error("useTimeLineChartStore needs a TimelineChartContext");
  return store;
}
