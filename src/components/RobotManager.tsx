"use client";

import { useState, useTransition } from "react";
import { Bot, Trash2 } from "lucide-react";
import { addRobot, deleteRobot, updateRobot } from "@/app/actions";
import { Panel } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECTS, ROBOT_MODELS, type Project, type RobotModel } from "@/lib/projects";
import { displayName, type Member } from "@/lib/types";
import type { Robot } from "@/lib/workers";

const NONE = "none";

/** Admin list of robots: add one, change its project or person, remove it. */
export function RobotManager({ robots, members }: { robots: Robot[]; members: Member[] }) {
  const t = useT();
  const r = t.robots;
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [model, setModel] = useState<RobotModel>("agibot_x2");

  const save = (robot: Robot, patch: Partial<Robot>) =>
    startTransition(() => updateRobot(robot.id, { name: robot.name, model: robot.model, project: robot.project, profileId: robot.profileId, ...patch }));

  return (
    <Panel icon={<Bot />} title={r.title} action={<span className="text-xs tabular-nums">{robots.length}</span>}>
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">{r.description}</p>
      <form
        className="flex flex-wrap gap-2 border-b p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(async () => {
            await addRobot({ name, model, project: null, profileId: null });
            setName("");
          });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={r.namePlaceholder} aria-label={r.name} className="min-w-40 flex-1" maxLength={60} />
        <Select value={model} onValueChange={(v) => setModel(v as RobotModel)}>
          <SelectTrigger aria-label={r.model} className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROBOT_MODELS.map((m) => (
              <SelectItem key={m} value={m}>
                {r.models[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={pending || !name.trim()}>{r.add}</Button>
      </form>
      {robots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{r.none}</p>
      ) : (
        <ul className="divide-y">
          {robots.map((robot) => (
            <li key={robot.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <div className="min-w-32 flex-1">
                <div className="truncate text-sm font-medium">{robot.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.models[robot.model]}</div>
              </div>
              <Select value={robot.project ?? NONE} onValueChange={(v) => save(robot, { project: v === NONE ? null : (v as Project) })}>
                <SelectTrigger aria-label={r.project} className="w-48" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{r.noProject}</SelectItem>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t.projects[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={robot.profileId ?? NONE} onValueChange={(v) => save(robot, { profileId: v === NONE ? null : v })}>
                <SelectTrigger aria-label={r.assignee} className="w-44" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{r.nobody}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {displayName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon-sm" aria-label={r.remove} disabled={pending} onClick={() => startTransition(() => deleteRobot(robot.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
