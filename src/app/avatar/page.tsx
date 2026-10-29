import { PageHeader, Panel } from "@/components/atoms";
import { Camera, Smile } from "lucide-react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { PhotoUpload } from "@/components/PhotoUpload";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export default async function AvatarPage() {
  const user = await requireUser();
  const t = await getT();
  const s = t.settings;
  return (
    <main>
      <PageHeader title={s.title} description={s.description} />
      <div className="max-w-2xl space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<Camera />} title={s.photoTitle}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{s.photoHint}</p>
            <PhotoUpload me={{ id: user.id, name: user.name, email: user.email, image: user.image, avatar: user.avatar }} />
          </div>
        </Panel>
        <Panel icon={<Smile />} title={s.avatarTitle}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{s.avatarHint}</p>
            <AvatarPicker me={{ id: user.id, name: user.name, email: user.email, image: user.image, avatar: user.avatar }} />
          </div>
        </Panel>
      </div>
    </main>
  );
}
