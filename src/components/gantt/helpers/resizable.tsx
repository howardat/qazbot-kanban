"use client";

// Plane's gantt-chart/helpers/blockResizables/{left,right}-resizable, drawn as the app's grips.
import { cn } from "@/lib/utils";
import type { DragDirection } from "../types";

type ResizableProps = {
  enableBlockResize: boolean;
  handleBlockDrag: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, dragDirection: DragDirection) => void;
  side: "left" | "right";
};

export function Resizable({ enableBlockResize, handleBlockDrag, side }: ResizableProps) {
  if (!enableBlockResize) return null;
  return (
    <div
      data-resize={side}
      aria-hidden
      onMouseDown={(e) => handleBlockDrag(e, side)}
      className={cn(
        // A wide grab zone across the bar's edge, mostly inside it, so the visible edge is easy to catch.
        "absolute top-0 z-[8] h-full w-3.5 cursor-col-resize opacity-0 group-hover/bar:opacity-100",
        side === "left" ? "-left-1" : "-right-1",
      )}
    >
      <span className="absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current/50" />
    </div>
  );
}
