"use client";

import { Plus } from "lucide-react";
import { createBoard } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/components/I18nProvider";
import { Input } from "@/components/ui/input";

/** Opens the new-board dialog; pass `trigger` to replace the default button. */
export function NewBoardButton({ trigger }: { trigger?: React.ReactNode }) {
  const t = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> {t.nav.newBoard}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={createBoard} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t.newBoard.title}</DialogTitle>
            <DialogDescription>{t.newBoard.description}</DialogDescription>
          </DialogHeader>
          <Input name="name" required maxLength={200} autoFocus placeholder={t.newBoard.placeholder} aria-label={t.newBoard.nameAria} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t.common.cancel}
              </Button>
            </DialogClose>
            <Button>{t.newBoard.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
