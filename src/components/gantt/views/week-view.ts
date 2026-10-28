// Plane's gantt-chart/views/week-view.
import { generateWeeks, months } from "../data";
import { EStartOfTheWeek, type ChartDataType } from "../types";
import { getNumberOfDaysBetweenTwoDates, getWeekNumberByDate } from "./helpers";

export interface IDayBlock {
  date: Date;
  day: number;
  dayData: {
    key: number;
    shortTitle: string;
    title: string;
    abbreviation: string;
  };
  title: string;
  today: boolean;
}

export interface IWeekBlock {
  children?: IDayBlock[];
  weekNumber: number;
  weekData: {
    shortTitle: string;
    title: string;
  };
  title: string;
  startDate: Date;
  endDate: Date;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  today: boolean;
}

const generateWeekChart = (
  weekPayload: ChartDataType,
  side: null | "left" | "right",
  targetDate?: Date,
  startOfWeek: EStartOfTheWeek = EStartOfTheWeek.SUNDAY,
) => {
  let renderState = weekPayload;

  const range: number = renderState.data.approxFilterRange || 6;
  let filteredDates: IWeekBlock[] = [];
  let minusDate: Date = new Date();
  let plusDate: Date = new Date();

  let startDate = new Date();
  let endDate = new Date();

  // if side is null generate weeks on both side of current date
  if (side === null) {
    const currentDate = renderState.data.currentDate;

    minusDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - range, currentDate.getDate());
    plusDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + range, currentDate.getDate());

    if (minusDate && plusDate) filteredDates = getWeeksBetweenTwoDates(minusDate, plusDate, true, startOfWeek);

    startDate = filteredDates[0].startDate;
    endDate = filteredDates[filteredDates.length - 1].endDate;
    renderState = {
      ...renderState,
      data: {
        ...renderState.data,
        startDate,
        endDate,
      },
    };
  }
  // When side is left, generate more weeks on the left side of the start date
  else if (side === "left") {
    const chartStartDate = renderState.data.startDate;
    const currentDate = targetDate ? targetDate : chartStartDate;

    minusDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - range, 1);
    plusDate = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), chartStartDate.getDate() - 1);

    if (minusDate && plusDate) filteredDates = getWeeksBetweenTwoDates(minusDate, plusDate, true, startOfWeek);

    startDate = filteredDates[0].startDate;
    endDate = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), chartStartDate.getDate() - 1);
    renderState = {
      ...renderState,
      data: { ...renderState.data, startDate },
    };
  }
  // When side is right, generate more weeks on the right side of the end date
  else if (side === "right") {
    const chartEndDate = renderState.data.endDate;
    const currentDate = targetDate ? targetDate : chartEndDate;

    minusDate = new Date(chartEndDate.getFullYear(), chartEndDate.getMonth(), chartEndDate.getDate() + 1);
    plusDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + range, 1);

    if (minusDate && plusDate) filteredDates = getWeeksBetweenTwoDates(minusDate, plusDate, true, startOfWeek);

    startDate = new Date(chartEndDate.getFullYear(), chartEndDate.getMonth(), chartEndDate.getDate() + 1);
    endDate = filteredDates[filteredDates.length - 1].endDate;
    renderState = {
      ...renderState,
      data: { ...renderState.data, endDate },
    };
  }

  const days = Math.abs(getNumberOfDaysBetweenTwoDates(startDate, endDate)) + 1;
  const scrollWidth = days * weekPayload.data.dayWidth;

  return { state: renderState, payload: filteredDates, scrollWidth: scrollWidth };
};

export const getWeeksBetweenTwoDates = (
  startDate: Date,
  endDate: Date,
  shouldPopulateDaysForWeek: boolean = true,
  startOfWeek: EStartOfTheWeek = EStartOfTheWeek.SUNDAY,
): IWeekBlock[] => {
  const weeks: IWeekBlock[] = [];

  const currentDate = new Date(startDate.getTime());
  const today = new Date();

  // Adjust the current date to the start of the week
  const day = currentDate.getDay();
  const diff = (day + 7 - startOfWeek) % 7; // Calculate days to subtract to get to startOfWeek
  currentDate.setDate(currentDate.getDate() - diff);

  while (currentDate <= endDate) {
    const weekStartDate = new Date(currentDate.getTime());
    // Plane adds 6 × 24h; stepping by calendar days stays right across daylight-saving changes.
    const weekEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 6);

    const monthAtStartOfTheWeek = weekStartDate.getMonth();
    const yearAtStartOfTheWeek = weekStartDate.getFullYear();
    const monthAtEndOfTheWeek = weekEndDate.getMonth();
    const yearAtEndOfTheWeek = weekEndDate.getFullYear();

    const weekNumber = getWeekNumberByDate(currentDate);

    weeks.push({
      children: shouldPopulateDaysForWeek ? populateDaysForWeek(weekStartDate, startOfWeek) : undefined,
      weekNumber,
      weekData: {
        shortTitle: `w${weekNumber}`,
        title: `Week ${weekNumber}`,
      },
      title:
        monthAtStartOfTheWeek === monthAtEndOfTheWeek
          ? `${months[monthAtStartOfTheWeek].abbreviation} ${yearAtStartOfTheWeek}`
          : `${months[monthAtStartOfTheWeek].abbreviation} ${yearAtStartOfTheWeek} - ${months[monthAtEndOfTheWeek].abbreviation} ${yearAtEndOfTheWeek}`,
      startMonth: monthAtStartOfTheWeek,
      startYear: yearAtStartOfTheWeek,
      endMonth: monthAtEndOfTheWeek,
      endYear: yearAtEndOfTheWeek,
      startDate: weekStartDate,
      endDate: weekEndDate,
      today: today >= weekStartDate && today <= weekEndDate ? true : false,
    });

    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
};

const populateDaysForWeek = (startDate: Date, startOfWeek: EStartOfTheWeek = EStartOfTheWeek.SUNDAY): IDayBlock[] => {
  const currentDate = new Date(startDate);
  const days: IDayBlock[] = [];
  const today = new Date();
  const weekDays = generateWeeks(startOfWeek);

  for (let i = 0; i < 7; i++) {
    days.push({
      date: new Date(currentDate),
      day: currentDate.getDay(),
      dayData: weekDays[i],
      title: `${weekDays[i].abbreviation} ${currentDate.getDate()}`,
      today: today.setHours(0, 0, 0, 0) == currentDate.setHours(0, 0, 0, 0),
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return days;
};

const mergeWeekRenderPayloads = (a: IWeekBlock[], b: IWeekBlock[]) => [...a, ...b];

export const weekView = {
  generateChart: generateWeekChart,
  mergeRenderPayloads: mergeWeekRenderPayloads,
};
