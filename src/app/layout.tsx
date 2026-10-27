import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { AppSidebar, SIDEBAR_COOKIE } from "@/components/AppSidebar";
import { I18nProvider } from "@/components/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadBoards } from "@/lib/data";
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
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const boards = user ? await loadBoards() : [];

  return (
    <html lang={locale}>
      <body className={`${inter.variable} min-h-screen bg-background font-sans antialiased`}>
        <I18nProvider locale={locale}>
          <TooltipProvider delayDuration={300}>
            {user ? (
              // Plane's shell: sidebar on the canvas, the page in an inset panel that scrolls on its own.
              <div className="flex h-dvh flex-col md:flex-row">
                <Suspense>
                  <AppSidebar
                    boards={boards}
                    user={{ id: user.id, name: user.name, email: user.email, image: user.image }}
                    isAdmin={user.role === "admin"}
                    collapsed={sidebarCollapsed}
                  />
                </Suspense>
                <div className="min-h-0 min-w-0 flex-1 md:py-2 md:pr-2">
                  <div id="page" className="h-full overflow-y-auto bg-card md:rounded-lg md:border md:shadow-xs">
                    {children}
                  </div>
                </div>
              </div>
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
