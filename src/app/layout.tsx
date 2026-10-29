import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { I18nProvider } from "@/components/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadBoards, loadOpenCounts } from "@/lib/data";
import { dictFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Qazbot Kanban", description: dictFor(await getLocale()).meta.description };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  // shadcn's sidebar remembers open/collapsed in this cookie; reading it here makes the first paint match.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const [boards, openCounts] = user ? await Promise.all([loadBoards(user), loadOpenCounts(user)]) : [[], {}];

  return (
    <html lang={locale}>
      <body className={`${inter.variable} min-h-screen bg-background font-sans antialiased`}>
        <I18nProvider locale={locale}>
          <TooltipProvider delayDuration={300}>
            {user ? (
              // shadcn sidebar-07 shell: the sidebar (collapses to icons; its toggle lives in the sidebar), the page beside it.
              <SidebarProvider defaultOpen={sidebarOpen} className="h-dvh min-h-0">
                <Suspense>
                  <AppSidebar boards={boards} counts={openCounts} user={{ id: user.id, name: user.name, email: user.email, image: user.image }} isAdmin={user.role === "admin"} updatesSeen={user.updatesSeen} />
                </Suspense>
                <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-card">
                  {/* On phones the sidebar is an off-canvas sheet, so its toggle floats over the page. */}
                  <SidebarTrigger className="fixed top-2 left-2 z-40 bg-card shadow-sm md:hidden" />
                  <div id="page" className="min-h-0 flex-1 overflow-y-auto">
                    {children}
                  </div>
                </div>
              </SidebarProvider>
            ) : (
              children
            )}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
