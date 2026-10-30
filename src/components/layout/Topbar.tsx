import { Bell, CircleHelp, Grip, Moon, UserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Topbar() {
  return (
    <header className="z-40 flex h-[60px] shrink-0 items-center border-b border-border bg-white px-5">
      <button className="rounded-md p-2 hover:bg-muted" aria-label="App switcher">
        <Grip className="h-5 w-5 text-[#4B5563]" />
      </button>
      <Link
        to="/dashboard"
        className="ml-4 text-[24px] font-bold tracking-[-0.02em] text-[#111827]"
      >
        AppViewX
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <button className="rounded-md p-2 hover:bg-muted" aria-label="Dark mode">
          <Moon className="h-5 w-5 text-[#374151]" strokeWidth={1.75} />
        </button>
        <button className="rounded-md p-2 hover:bg-muted" aria-label="Help">
          <CircleHelp className="h-5 w-5 text-[#374151]" strokeWidth={1.75} />
        </button>
        <button className="rounded-md p-2 hover:bg-muted" aria-label="Notifications">
          <Bell className="h-5 w-5 text-[#374151]" strokeWidth={1.75} />
        </button>
        <button className="rounded-md p-2 hover:bg-muted" aria-label="Account">
          <UserRound className="h-5 w-5 text-[#374151]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
