import { Bell, Code2, HelpCircle, LayoutGrid } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-[52px] bg-surface border-b border-border flex items-center px-4 sticky top-0 z-20">
      <button className="p-2 rounded hover:bg-muted" title="App switcher">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="ml-2 flex items-center">
        <span className="font-semibold tracking-tight text-[15px]">
          AppViewX <span className="text-muted-foreground font-normal">| SSH</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button className="p-2 rounded hover:bg-muted" title="Developer">
          <Code2 className="h-4 w-4 text-muted-foreground" />
        </button>
        <button className="p-2 rounded hover:bg-muted" title="Help">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>
        <button className="relative p-2 rounded hover:bg-muted" title="Notifications">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-brand-accent" />
        </button>
        <div className="ml-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold">
          AV
        </div>
      </div>
    </header>
  );
}
