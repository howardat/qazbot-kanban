"use client";

// Plane's gantt-chart/helpers/add-block: a + that follows the pointer along a row without dates,
// snapping to days; a click schedules the card on that day.
import { useState } from "react";
import { Plus } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useTimeLineChartStore } from "../context";
import { toISO } from "../views/helpers";

type Props = {
  title: string;
  onAdd: (day: Date) => void;
};

export function ChartAddBlock({ title, onAdd }: Props) {
  const t = useT();
  const [column, setColumn] = useState<number | null>(null);
  const { currentViewData } = useTimeLineChartStore();
  const { startDate: chartStartDate, dayWidth } = currentViewData.data;
  const day = column === null ? null : new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), chartStartDate.getDate() + column);

  return (
    <div
      className="absolute inset-0"
      onMouseMove={(e) => setColumn(Math.max(0, Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / dayWidth)))}
      onMouseLeave={() => setColumn(null)}
    >
      {day && column !== null && (
        <button
          type="button"
          onClick={() => onAdd(day)}
          title={t.timeline.scheduleOn(toISO(day))}
          aria-label={t.timeline.scheduleAria(title, toISO(day))}
          className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-sm border border-border-strong bg-card text-muted-foreground shadow-xs hover:text-foreground"
          style={{ left: column * dayWidth + dayWidth / 2 }}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
