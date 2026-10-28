"use client";

// Plane's gantt-chart/blocks/block-row: behind a bar. When the bar is scrolled out of view an arrow
// jumps to it; a card without dates gets the add-block +.
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_WIDTH } from "../constants";
import type { IGanttBlock } from "../types";

type Props = {
  block: IGanttBlock;
  title: string;
  handleScrollToBlock: (block: IGanttBlock) => void;
  addBlock?: React.ReactNode;
  ganttContainerRef: React.RefObject<HTMLDivElement | null>;
};

export function BlockRow(props: Props) {
  const { block, title, handleScrollToBlock, addBlock, ganttContainerRef } = props;
  // states
  const [isHidden, setIsHidden] = useState(false);
  const [isBlockHiddenOnLeft, setIsBlockHiddenOnLeft] = useState(false);

  // Keyed on the id and whether the bar exists: the block object is new on every render.
  const hasBar = !!block.position;
  useEffect(() => {
    const intersectionRoot = ganttContainerRef.current;
    const timelineBlock = document.getElementById(`gantt-block-${block.id}`);
    if (!timelineBlock || !intersectionRoot) return;

    // Observe if the block is visible on the chart
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsHidden(!entry.isIntersecting);
          setIsBlockHiddenOnLeft(entry.boundingClientRect.right < (entry.rootBounds?.left ?? 0));
        });
      },
      {
        root: intersectionRoot,
        rootMargin: `0px 0px 0px -${SIDEBAR_WIDTH}px`,
      },
    );

    observer.observe(timelineBlock);

    return () => {
      observer.unobserve(timelineBlock);
    };
  }, [block.id, hasBar, ganttContainerRef]);

  const isBlockVisibleOnChart = block.start_date || block.target_date;

  return (
    <div className="absolute inset-0">
      {isBlockVisibleOnChart
        ? isHidden && (
            <button
              type="button"
              data-jump={block.id}
              aria-label={title}
              title={title}
              className="sticky z-[6] mt-1.5 grid size-7 cursor-pointer place-items-center rounded-sm border border-border-strong bg-card text-muted-foreground shadow-xs hover:text-foreground"
              style={{
                left: `${SIDEBAR_WIDTH + 4}px`,
              }}
              onClick={() => handleScrollToBlock(block)}
            >
              <ArrowRight
                className={cn("size-3.5", {
                  "rotate-180": isBlockHiddenOnLeft,
                })}
              />
            </button>
          )
        : addBlock}
    </div>
  );
}
