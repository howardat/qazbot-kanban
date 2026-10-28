// Plane's gantt-chart/views/helpers, with block positions worked out on the app's ISO days.
import { diffDays, type ISODate } from "@/lib/dates";
import { DEFAULT_BLOCK_WIDTH } from "../constants";
import type { BlockPosition, ChartDataType, IGanttBlock } from "../types";

export const generateDate = (day: number, month: number, year: number) => new Date(year, month, day);

export const getNumberOfDaysInMonth = (month: number, year: number) => {
  const date = new Date(year, month + 1, 0);

  return date.getDate();
};

export const getWeekNumberByDate = (date: Date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const daysOffset = firstDayOfYear.getDay();

  const firstWeekStart = firstDayOfYear.getTime() - daysOffset * 24 * 60 * 60 * 1000;
  const weekStart = new Date(firstWeekStart);

  const weekNumber = Math.floor((date.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  return weekNumber;
};

export const getNumberOfDaysBetweenTwoDates = (startDate: Date, endDate: Date) => {
  let daysDifference: number = 0;
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const timeDifference: number = startDate.getTime() - endDate.getTime();
  daysDifference = Math.round(timeDifference / (1000 * 60 * 60 * 24));

  return daysDifference;
};

/** A local calendar Date as the app's "YYYY-MM-DD". */
export const toISO = (date: Date): ISODate =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` as ISODate;

/** "YYYY-MM-DD" as a local calendar Date (midnight). */
export const fromISO = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export const getDateFromPositionOnGantt = (position: number, chartData: ChartDataType, offsetDays = 0) => {
  const numberOfDaysSinceStart = Math.round(position / chartData.data.dayWidth) + offsetDays;
  const newDate = new Date(chartData.data.startDate);
  newDate.setDate(newDate.getDate() + numberOfDaysSinceStart);
  return newDate;
};

export const getPositionFromDate = (chartData: ChartDataType, date: string, offsetWidth: number) =>
  diffDays(date as ISODate, toISO(chartData.data.startDate)) * chartData.data.dayWidth + offsetWidth;

export const getItemPositionWidth = (chartData: ChartDataType, itemData: IGanttBlock): BlockPosition | undefined => {
  let scrollPosition: number = 0;
  let scrollWidth: number = DEFAULT_BLOCK_WIDTH;

  const { start_date, target_date } = itemData;

  if (!start_date && !target_date) return;

  // get scroll position from the number of days and width of each day
  scrollPosition = start_date
    ? getPositionFromDate(chartData, start_date, 0)
    : getPositionFromDate(chartData, target_date!, -1 * DEFAULT_BLOCK_WIDTH + chartData.data.dayWidth);

  if (start_date && target_date) {
    // get width of block
    const widthDaysDifference = Math.abs(diffDays(target_date as ISODate, start_date as ISODate));
    scrollWidth = (widthDaysDifference + 1) * chartData.data.dayWidth;
  }

  return { marginLeft: scrollPosition, width: scrollWidth };
};
