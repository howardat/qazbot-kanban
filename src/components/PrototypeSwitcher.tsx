"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * PROTOTYPE tooling: a floating pill that flips between UI variants via `?variant=`. ←/→ also cycle
 * (not while typing). Never renders in production builds.
 */
export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = Math.max(0, variants.findIndex((v) => v.key === params.get("variant")));

  const go = useCallback(
    (step: number) => {
      const next = variants[(current + step + variants.length) % variants.length];
      const sp = new URLSearchParams(params);
      sp.set("variant", next.key);
      router.replace(`${pathname}?${sp}`, { scroll: false });
    },
    [current, variants, params, pathname, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;
  const v = variants[current];
  return (
    <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 p-1 text-sm text-white shadow-xl ring-1 ring-white/10 print:hidden">
      <button type="button" onClick={() => go(-1)} className="grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label="Previous variant">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-44 px-2 text-center font-medium tabular-nums">
        {v.key} <span className="text-white/60">({v.name})</span> <span className="text-white/40">{current + 1}/{variants.length}</span>
      </span>
      <button type="button" onClick={() => go(1)} className="grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label="Next variant">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
