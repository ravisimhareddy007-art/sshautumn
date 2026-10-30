import { Bell, CircleHelp, Grip, Moon, UserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Topbar() {
  return (
    <header className="z-40 flex h-[46px] shrink-0 items-center border-b border-border bg-white px-3">
      <button className="rounded-md p-1.5 hover:bg-muted" aria-label="App switcher">
        <Grip className="h-4 w-4 text-[#4B5563]" />
      </button>
      <Link
        to="/dashboard"
        className="ml-3 text-[19px] font-bold tracking-[-0.02em] text-[#111827]"
      >
        AppViewX
      </Link>

      <div className="ml-auto flex items-center gap-2.5">
        <button className="rounded-md p-1.5 hover:bg-muted" aria-label="Dark mode">
          <Moon className="h-[17px] w-[17px] text-[#374151]" strokeWidth={1.75} />
        </button>
        <button className="rounded-md p-1.5 hover:bg-muted" aria-label="Help">
          <CircleHelp className="h-[17px] w-[17px] text-[#374151]" strokeWidth={1.75} />
        </button>
        <button className="rounded-md p-1.5 hover:bg-muted" aria-label="Notifications">
          <Bell className="h-[17px] w-[17px] text-[#374151]" strokeWidth={1.75} />
        </button>
        <button className="rounded-md p-1.5 hover:bg-muted" aria-label="Account">
          <UserRound className="h-[17px] w-[17px] text-[#374151]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
