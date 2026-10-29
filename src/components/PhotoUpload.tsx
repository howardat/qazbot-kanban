"use client";

import { useRef, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { removePhoto, uploadPhoto } from "@/app/avatar/actions";
import { Avatar } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { PHOTO_SIZE } from "@/lib/photo-files";
import type { Member } from "@/lib/types";

/** Crops the middle square of an image and shrinks it to PHOTO_SIZE, as a small WebP. */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Couldn't encode the photo");
  return blob;
}

/** Upload, replace or remove your profile photo; it shows instead of initials next to your name. */
export function PhotoUpload({ me }: { me: Member }) {
  const t = useT();
  const s = t.settings;
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const upload = (file: File) =>
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await squarePhoto(file);
      } catch {
        toast.error(s.photoInvalid);
        return;
      }
      const form = new FormData();
      form.set("photo", new File([blob], "photo.webp", { type: blob.type }));
      const { error } = await uploadPhoto(form);
      if (error) toast.error(error);
    });
  return (
    <div className="flex items-center gap-4">
      <Avatar member={me} size={64} className="ring-0" />
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
        <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          <Upload /> {pending ? s.photoUploading : me.image ? s.photoReplace : s.photoUpload}
        </Button>
        {me.image && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => startTransition(() => removePhoto())}>
            <Trash2 /> {s.remove}
          </Button>
        )}
      </div>
    </div>
  );
}
