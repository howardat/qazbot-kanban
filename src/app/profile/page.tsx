import { PageHeader, Panel } from "@/components/atoms";
import { Camera, IdCard, KeyRound, Mail, Smile } from "lucide-react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { PhotoUpload } from "@/components/PhotoUpload";
import { DetailsForm, EmailForm } from "@/components/ProfileForms";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export default async function ProfilePage() {
  const user = await requireUser();
  const t = await getT();
  const s = t.settings;
  return (
    <main>
      <PageHeader title={s.title} description={s.description} />
      <div className="max-w-2xl space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<IdCard />} title={s.detailsTitle}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{s.detailsHint}</p>
            <DetailsForm name={user.name} />
          </div>
        </Panel>
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
        <Panel icon={<Mail />} title={s.emailTitle}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{s.emailHint}</p>
            <EmailForm email={user.email} />
          </div>
        </Panel>
        <Panel icon={<KeyRound />} title={s.passwordTitle}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{s.passwordHint}</p>
            <ChangePasswordForm email={user.email} />
          </div>
        </Panel>
      </div>
    </main>
  );
}
