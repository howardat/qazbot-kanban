"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addEmployeeNote, deleteEmployeeNote } from "@/app/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Note = { id: string; text: string; when: string; author: string };

/** Admin-only log of notes about one person: newest first, each one deletable. */
export function EmployeeNotes({ profileId, notes }: { profileId: string; notes: Note[] }) {
  const t = useT();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <form
        className="space-y-2 border-b p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          startTransition(async () => {
            await addEmployeeNote(profileId, text);
            setText("");
          });
        }}
      >
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.workers.notePlaceholder} maxLength={5000} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending || !text.trim()}>
            {t.workers.addNote}
          </Button>
        </div>
      </form>
      {notes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t.workers.noNotes}</p>
      ) : (
        <ul className="divide-y">
          {notes.map((n) => (
            <li key={n.id} className="group flex gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {n.author} · {n.when}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{n.text}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t.workers.deleteNote}
                disabled={pending}
                onClick={() => startTransition(() => deleteEmployeeNote(n.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
