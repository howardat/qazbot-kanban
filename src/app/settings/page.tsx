import { KeyRound } from "lucide-react";
import { PageHeader, Panel } from "@/components/atoms";
import { PersonalKeyForm } from "@/components/PersonalKeyForm";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getT();
  const s = t.settings;
  return (
    <main>
      <PageHeader title={s.title} description={s.description} />
      <div className="max-w-2xl space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<KeyRound />} title={s.keyTitle}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{s.keyHint}</p>
            <PersonalKeyForm hint={user.openrouterKeyHint} teamKey={!!process.env.OPENROUTER_API_KEY} />
          </div>
        </Panel>
      </div>
    </main>
  );
}
