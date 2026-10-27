"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Maximize, Minimize } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { WorkerSheet } from "@/components/WorkerSheet";
import { WorkersRoster } from "@/components/WorkersRoster";
import { AGE_COLORS, PAL } from "@/components/office/palette";
import type { Robot, Worker } from "@/lib/workers";

// three.js only loads on this page, in the browser; the server just sends the people and robots.
const WorkersScene = dynamic(() => import("@/components/WorkersScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" style={{ background: PAL.bg }} />,
});

const REFRESH_MS = 30_000;

/**
 * The same data for as long as it hasn't changed, so a refetch that brings nothing new doesn't rebuild
 * the 3D scene (which would also reset the view).
 */
function useStable<T>(value: T): T {
  const ref = useRef({ key: JSON.stringify(value), value });
  const key = JSON.stringify(value);
  if (key !== ref.current.key) ref.current = { key, value };
  return ref.current.value;
}

/** The office view filling the page, with a floating legend, team list and full-screen toggle. */
export function WorkersView({
  workers: fresh,
  robots: freshRobots,
}: {
  workers: Worker[];
  robots: Robot[];
}) {
  const t = useT();
  const router = useRouter();
  const workers = useStable(fresh);
  const robots = useStable(freshRobots);
  // Keep the office live: refetch every 30 s while the tab is visible, and right away when it's shown again.
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  const w = t.workers;
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // The sheet renders inside the office element so it stays visible in full screen.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // Relative times and staleness follow the clock without refetching: one tick a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const onChange = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen());

  return (
    <div
      ref={(el) => {
        box.current = el;
        setContainer(el);
      }}
      className="relative h-full min-h-[480px] w-full overflow-hidden" style={{ background: PAL.bg }}>
      <WorkersScene workers={workers} robots={robots} now={now} onSelect={setSelected} />
      {/* Vignette like the reference art; it never takes clicks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45))]" />

      <div className="pointer-events-none absolute top-3 left-3 flex items-start gap-2 md:top-4 md:left-4">
        <h1 className="sr-only">{w.title}</h1>
        <button
          type="button"
          onClick={toggle}
          aria-label={full ? w.exitFullscreen : w.fullscreen}
          title={full ? w.exitFullscreen : w.fullscreen}
          className="pointer-events-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-[#24201c]/90 text-[#f1ebe1] shadow-lg outline-none hover:bg-[#3a332d] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
      </div>

      {/* Team list docked on the right, full height */}
      <div className="pointer-events-none absolute inset-y-3 right-3 flex md:inset-y-4 md:right-4">
        <WorkersRoster workers={workers} now={now} onSelect={setSelected} />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-[#24201c]/90 px-3 py-1.5 text-[11px] text-[#f1ebe1] shadow-lg md:bottom-4 md:left-4">
        {/* The colours of the age rings around people's avatars */}
        <Legend color={AGE_COLORS.fresh} label={w.legendFresh} />
        <Legend color={AGE_COLORS.dim} label={w.legendDim} />
        <Legend color={AGE_COLORS.stale} label={w.legendStale} />
      </div>

      <WorkerSheet
        worker={workers.find((x) => x.id === selected) ?? null}
        robots={robots}
        now={now}
        container={container}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm ring-1 ring-white/30" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
