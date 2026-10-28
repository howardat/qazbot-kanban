"use client";

// Plane's gantt-chart/blocks/block: the bar for one card, placed by its dates.
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { BLOCK_HEIGHT } from "../constants";
import { ChartDraggable } from "../helpers/draggable";
import { useGanttResizable, type BlockDateUpdate } from "../helpers/use-gantt-resizable";
import type { IGanttBlock } from "../types";

type Props = {
  block: IGanttBlock;
  children: React.ReactNode;
  enableBlockLeftResize: boolean;
  enableBlockRightResize: boolean;
  enableBlockMove: boolean;
  ganttContainerRef: React.RefObject<HTMLDivElement | null>;
  updateBlockDates?: (update: BlockDateUpdate) => void;
};

export function GanttChartBlock(props: Props) {
  const { block, children, enableBlockLeftResize, enableBlockRightResize, enableBlockMove, ganttContainerRef, updateBlockDates } = props;
  // refs
  const resizableRef = useRef<HTMLDivElement>(null);

  const { isMoving, handleBlockDrag } = useGanttResizable(block, resizableRef, ganttContainerRef, updateBlockDates);

  if (!block.position) return null;

  return (
    <div
      className={cn("pointer-events-none absolute top-0 left-0 z-[5]", isMoving && "z-[7]")}
      id={`gantt-block-${block.id}`}
      data-bar={block.id}
      ref={resizableRef}
      style={{
        height: `${BLOCK_HEIGHT}px`,
        marginLeft: `${block.position.marginLeft}px`,
        width: `${block.position.width}px`,
      }}
    >
      <div className="pointer-events-auto relative h-full w-full">
        <ChartDraggable
          block={block}
          handleBlockDrag={handleBlockDrag}
          enableBlockLeftResize={enableBlockLeftResize}
          enableBlockRightResize={enableBlockRightResize}
          enableBlockMove={enableBlockMove}
          isMoving={isMoving}
        >
          {children}
        </ChartDraggable>
      </div>
    </div>
  );
}
