import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLeaf {
  label: string;
  to: string;
}
interface NavGroup {
  label: string;
  children?: NavGroup[];
  to?: string;
}

type Section = {
  header: string;
  to?: string;
  defaultOpen?: boolean;
  children?: NavGroup[];
};

const SECTIONS: Section[] = [
  { header: "GET STARTED", to: "/dashboard" },
  { header: "DASHBOARD", to: "/dashboard" },
  {
    header: "DISCOVERY",
    defaultOpen: false,
    children: [
      { label: "Discovery Profiles", to: "/discovery/profiles" },
      { label: "Discovery Runs", to: "/discovery/runs" },
      { label: "Discovery Status", to: "/discovery/status" },
    ],
  },
  {
    header: "INVENTORY",
    defaultOpen: true,
    children: [
      {
        label: "Key Inventory",
        children: [
          { label: "User Key Inventory", to: "/inventory/keys/user" },
          { label: "Host Key Inventory", to: "/inventory/keys/host" },
          { label: "Recently Deleted Keys", to: "/inventory/keys/deleted" },
          { label: "Recently Rotated Keys", to: "/inventory/keys/rotated" },
        ],
      },
      {
        label: "Certificate Inventory",
        children: [
          { label: "User Certificate Inventory", to: "/inventory/certificates/user" },
          { label: "Host Certificate Inventory", to: "/inventory/certificates/host" },
          { label: "Recently Rotated Certificates", to: "/inventory/certificates/rotated" },
          { label: "Recently Deleted Certificates", to: "/inventory/certificates/deleted" },
        ],
      },
      { label: "Host Inventory", to: "/inventory/hosts" },
    ],
  },
  { header: "GROUPS", to: "/groups" },
  {
    header: "POLICIES",
    defaultOpen: false,
    children: [
      { label: "Host Policy", to: "/policies/host" },
      { label: "Key Policy", to: "/policies/key" },
    ],
  },
  {
    header: "ADMINISTRATION",
    defaultOpen: false,
    children: [
      { label: "Device Management", to: "/administration/devices" },
      { label: "Certificate Authority", to: "/administration/ca" },
      { label: "Advanced Settings", to: "/administration/settings" },
      { label: "Tags", to: "/administration/tags" },
    ],
  },
];

function NavItem({
  label,
  to,
  active,
  depth = 0,
  badge,
}: {
  label: string;
  to: string;
  active: boolean;
  depth?: number;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 text-[13px] text-nav-text/80 hover:bg-nav-hover hover:text-nav-text transition-colors",
        active && "bg-nav-active text-nav-text",
      )}
      style={{ paddingLeft: 16 + depth * 16 }}
    >
      {active && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
      )}
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] text-nav-text/60">{badge}</span>
      )}
    </Link>
  );
}

function GroupNode({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const hasChildren = !!group.children?.length;
  const [open, setOpen] = useState(false);
  const timerRef = useState<{ t: ReturnType<typeof setTimeout> | null }>({ t: null })[0];

  if (!hasChildren && group.to) {
    return (
      <NavItem
        label={group.label}
        to={group.to}
        active={pathname === group.to}
        depth={1}
      />
    );
  }

  const openNow = () => {
    if (timerRef.t) {
      clearTimeout(timerRef.t);
      timerRef.t = null;
    }
    setOpen(true);
  };
  const closeSoon = () => {
    if (timerRef.t) clearTimeout(timerRef.t);
    timerRef.t = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-nav-text/80 hover:bg-nav-hover hover:text-nav-text"
        style={{ paddingLeft: 16 + 16 }}
      >
        <span className="truncate">{group.label}</span>
        <ChevronRight className="ml-auto h-3 w-3 opacity-70" />
      </button>
      {open && group.children && (
        <div
          className="absolute top-0 left-full z-50 min-w-[240px] py-2"
          style={{
            background: "#1B2437",
            borderRadius: "0 6px 6px 0",
            boxShadow: "4px 0 12px rgba(0,0,0,0.2)",
          }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          {group.children.map((c) =>
            c.to ? (
              <Link
                key={c.to}
                to={c.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "block text-[13px] transition-colors",
                  pathname === c.to
                    ? "text-white font-medium bg-nav-active"
                    : "text-white/75 hover:text-white hover:bg-nav-hover",
                )}
                style={{ padding: "10px 20px" }}
              >
                {c.label}
              </Link>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(SECTIONS.map((s) => [s.header, s.defaultOpen ?? true])),
  );

  return (
    <aside className="w-[240px] shrink-0 bg-nav text-nav-text h-screen sticky top-0 flex flex-col">
      {/* Product label */}
      <div className="h-[52px] flex items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Diamond className="h-4 w-4 text-brand-accent fill-brand-accent" />
          <span className="text-[16px] font-bold tracking-tight">SSH</span>
        </div>
        <button
          className="p-1.5 rounded hover:bg-nav-hover"
          title="Search nav"
        >
          <Search className="h-4 w-4 text-nav-text/70" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto nav-scroll py-2">
        {SECTIONS.map((s) => {
          const hasChildren = !!s.children?.length;
          if (!hasChildren && s.to) {
            const active = pathname === s.to;
            return (
              <Link
                key={s.header}
                to={s.to}
                className={cn(
                  "relative flex items-center px-4 py-2 text-[11px] uppercase-tracking font-semibold text-nav-text/70 hover:bg-nav-hover hover:text-nav-text",
                  active && "bg-nav-active text-nav-text",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                )}
                {s.header}
              </Link>
            );
          }
          const isOpen = openSections[s.header];
          return (
            <div key={s.header}>
              <button
                onClick={() =>
                  setOpenSections((p) => ({ ...p, [s.header]: !p[s.header] }))
                }
                className="w-full flex items-center px-4 py-2 text-[11px] uppercase-tracking font-semibold text-nav-section hover:text-nav-text"
              >
                {s.header}
                <ChevronDown
                  className={cn(
                    "ml-auto h-3 w-3 transition-transform",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>
              {isOpen &&
                s.children?.map((g, i) => (
                  <GroupNode key={i} group={g} pathname={pathname} />
                ))}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 text-[10px] text-nav-text/40 border-t border-white/5">
        AVX SSH · v3.0 Autumn
      </div>
    </aside>
  );
}
