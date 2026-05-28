import { AppDataProvider } from "@/hooks/use-app-data";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { EntryModal } from "@/components/entry/entry-modal";

// Authenticated area. Guarded by middleware (redirects to /login if no session).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* Bottom-nav padding so content doesn't hide under it on mobile. */}
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        </div>
      </div>
      <BottomNav />
      <EntryModal />
    </AppDataProvider>
  );
}
