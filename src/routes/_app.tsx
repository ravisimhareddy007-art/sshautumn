import { useState } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <main id="app-main" className="min-w-0 flex-1 overflow-y-auto px-6 pb-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
