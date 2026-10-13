import { AppDataProvider } from "@/hooks/use-app-data";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { EntryModal } from "@/components/entry/entry-modal";
import { MemoScanner } from "@/components/memo/memo-scanner";

// Authenticated area. Guarded by src/proxy.ts (no session → back to the landing page).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="flex min-h-screen min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* Bottom-nav padding so content doesn't hide under it on mobile. */}
          <main className="flex-1 pb-[var(--bottomnav-h)] lg:pb-0">{children}</main>
        </div>
      </div>
      <BottomNav />
      <EntryModal />
      <MemoScanner />
    </AppDataProvider>
  );
}
