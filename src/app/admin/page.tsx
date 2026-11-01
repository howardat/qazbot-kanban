import { asc } from "drizzle-orm";
import { ShieldCheck, ShieldMinus, ShieldPlus, UserMinus } from "lucide-react";
import { db } from "@/db";
import { allowedEmails, profiles } from "@/db/schema";
import { removeAllowedEmail, setRole } from "@/app/actions";
import { Avatar, PageHeader, Panel } from "@/components/atoms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteManager } from "@/components/InviteManager";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { RobotManager } from "@/components/RobotManager";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { loadMembers } from "@/lib/data";
import { loadActiveInvites } from "@/lib/invites";
import { requireAdmin } from "@/lib/session";
import { loadRobots } from "@/lib/workers";
import { displayName } from "@/lib/types";

export default async function AdminPage() {
  const admin = await requireAdmin();
  await track(admin.id, "admin.view");
  const t = await getT();
  const [emails, members, robots, people, invites] = await Promise.all([
    db.select().from(allowedEmails).orderBy(asc(allowedEmails.email)),
    db.select().from(profiles),
    loadRobots(),
    loadMembers(),
    loadActiveInvites(),
  ]);
  const byEmail = new Map(members.map((u) => [u.email, u]));
  const domain = process.env.ALLOWED_DOMAIN;

  return (
    <main>
      <PageHeader
        title={t.admin.title}
        description={
          <>
            {t.admin.description}
            {domain && <> {t.admin.domain(domain)}</>}
          </>
        }
      />
      <div className="max-w-3xl space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<ShieldCheck />} title={t.admin.people} action={<span className="text-xs tabular-nums">{emails.length}</span>}>
          <ul className="divide-y">
            {emails.map(({ email }) => {
              const u = byEmail.get(email);
              const isSelf = admin.email === email;
              return (
                <li key={email} className="flex items-center gap-3 px-4 py-3">
                  {u ? (
                    <Avatar member={u} size={34} className="ring-0" />
                  ) : (
                    <span className="size-[34px] shrink-0 rounded-full border border-dashed" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u ? displayName(u) : email}</div>
                    <div className="truncate text-xs text-muted-foreground">{u ? email : t.admin.notSignedIn}</div>
                  </div>
                  {u?.role === "admin" && <Badge variant="outline">{t.admin.adminBadge}</Badge>}
                  {isSelf ? (
                    <Badge variant="secondary">{t.admin.you}</Badge>
                  ) : (
                    <>
                      {u && <ResetPasswordButton profileId={u.id} name={displayName(u)} />}
                      {u && (
                        <form
                          action={async () => {
                            "use server";
                            await setRole(u.id, u.role === "admin" ? "member" : "admin");
                          }}
                        >
                          <Button variant="ghost" size="sm">
                            {u.role === "admin" ? <ShieldMinus /> : <ShieldPlus />}
                            {u.role === "admin" ? t.admin.removeAdmin : t.admin.makeAdmin}
                          </Button>
                        </form>
                      )}
                      <form
                        action={async () => {
                          "use server";
                          await removeAllowedEmail(email);
                        }}
                      >
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <UserMinus /> {t.admin.remove}
                        </Button>
                      </form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
        <InviteManager
          invites={invites.map((i) => ({ id: i.id, prefix: i.prefix, uses: i.uses, maxUses: i.maxUses, expiresAt: i.expiresAt.toISOString() }))}
        />
        <RobotManager robots={robots} members={people} />
      </div>
    </main>
  );
}
