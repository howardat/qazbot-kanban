"use client";

// Plane's gantt-chart/helpers/draggable: the bar with a resize grip at each end. While it moves, the
// new dates show above it.
import { useT } from "@/components/I18nProvider";
import { cn } from "@/lib/utils";
import { useTimeLineChartStore } from "../context";
import type { DragDirection, IGanttBlock } from "../types";
import { toISO } from "../views/helpers";
import { Resizable } from "./resizable";

type Props = {
  block: IGanttBlock;
  children: React.ReactNode;
  handleBlockDrag: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, dragDirection: DragDirection) => void;
  isMoving: DragDirection | undefined;
  enableBlockLeftResize: boolean;
  enableBlockRightResize: boolean;
  enableBlockMove: boolean;
};

export function ChartDraggable(props: Props) {
  const { block, children, handleBlockDrag, enableBlockLeftResize, enableBlockRightResize, enableBlockMove, isMoving } = props;
  const t = useT();
  const { getDateFromPositionOnGantt } = useTimeLineChartStore();
  const position = block.position;

  return (
    <div className="group/bar absolute inset-x-0.5 top-1.5 bottom-1.5 z-[6]">
      {isMoving && position && (
        <span className="absolute -top-5 left-0 z-[9] rounded-sm bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary shadow-xs">
          {t.timeline.range(
            toISO(getDateFromPositionOnGantt(position.marginLeft, 0)),
            toISO(getDateFromPositionOnGantt(position.marginLeft + position.width, -1)),
          )}
        </span>
      )}
      <div
        className={cn("h-full", { "pointer-events-none": isMoving })}
        onMouseDown={(e) => enableBlockMove && handleBlockDrag(e, "move")}
      >
        {children}
      </div>
      <Resizable side="left" enableBlockResize={enableBlockLeftResize} handleBlockDrag={handleBlockDrag} />
      <Resizable side="right" enableBlockResize={enableBlockRightResize} handleBlockDrag={handleBlockDrag} />
    </div>
  );
}
