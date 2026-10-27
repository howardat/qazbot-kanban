"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setAvatar } from "@/app/avatar/actions";
import { useT } from "@/components/I18nProvider";
import { AVATARS, lookOf } from "@/components/office/look";
import { LookIcon } from "@/components/PersonIcon";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/types";

/** Grid of the preset avatars plus "automatic"; picking one saves right away. */
export function AvatarPicker({ me }: { me: Member }) {
  const t = useT();
  const [chosen, setChosen] = useState<number | null>(me.avatar ?? null);
  const [pending, startTransition] = useTransition();
  const choose = (i: number | null) => {
    setChosen(i);
    startTransition(() => setAvatar(i));
  };
  const tile = (selected: boolean) =>
    cn(
      "relative grid cursor-pointer place-items-center rounded-xl border p-1.5 outline-none transition-colors hover:border-border-strong hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
      selected && "border-primary bg-primary/5 ring-2 ring-primary",
    );
  const mark = <Check className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-primary-gradient p-0.5 text-primary-foreground" />;
  return (
    <div className={cn("grid grid-cols-5 gap-2 sm:grid-cols-7", pending && "opacity-80")} role="radiogroup" aria-label={t.settings.avatarTitle}>
      <button type="button" role="radio" aria-checked={chosen === null} aria-label={t.settings.automaticHint} title={t.settings.automaticHint} onClick={() => choose(null)} className={tile(chosen === null)}>
        <LookIcon look={lookOf({ ...me, avatar: null })} size={48} />
        <span className="mt-1 max-w-full truncate text-[10px] text-muted-foreground">{t.settings.automatic}</span>
        {chosen === null && mark}
      </button>
      {AVATARS.map((look, i) => (
        <button key={i} type="button" role="radio" aria-checked={chosen === i} aria-label={t.settings.avatarN(i + 1)} onClick={() => choose(i)} className={tile(chosen === i)}>
          <LookIcon look={look} size={48} />
          {chosen === i && mark}
        </button>
      ))}
    </div>
  );
}
