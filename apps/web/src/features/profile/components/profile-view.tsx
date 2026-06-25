import { SidebarInset, SidebarProvider } from "@loyalty/ui";

import { AppSidebar } from "@/features/home/components/app-sidebar";
import { requireSession } from "@/lib/auth-guard";

import { ProfileScreen } from "./profile-screen";

/**
 * Customer profile / account — a faithful build of the "T4 · Perfil" Claude
 * Design template. Mobile-first; on desktop the bottom nav gives way to the
 * sidebar. Every section is wired to the real `profile` tRPC router (see
 * {@link ProfileScreen}): name / nickname / avatar edits, phone change via
 * OTP, Google link/unlink, plus the live stats, notification opt-outs, theme,
 * language and sign-out.
 */
export async function ProfileView() {
  await requireSession();

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-2xl lg:px-8 lg:pt-12">
          <ProfileScreen />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
