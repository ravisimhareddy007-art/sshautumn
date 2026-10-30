import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  LayoutGrid,
  Lightbulb,
  Minus,
  Plus,
  Radar,
  Search,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLeaf {
  label: string;
  to: string;
}
interface NavItem {
  label: string;
  to?: string;
  /** Items with children open a flyout to the right of the menu. */
  children?: NavLeaf[];
}
interface Section {
  header: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  to?: string;
  defaultOpen?: boolean;
  items?: NavItem[];
}

export const NAV: Section[] = [
  { header: "Get Started", icon: Lightbulb, to: "/get-started" },
  { header: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
  {
    header: "Discovery",
    icon: Radar,
    defaultOpen: true,
    items: [
      { label: "Network Scan", children: [{ label: "IP Range", to: "/discovery/network-scan" }] },
      { label: "Managed Devices", to: "/discovery/devices" },
      { label: "Discovery Status", to: "/discovery/status" },
      { label: "Scheduler", to: "/discovery/scheduler" },
    ],
  },
  {
    header: "Inventory",
    icon: ClipboardCheck,
    defaultOpen: true,
    items: [
      {
        label: "Key Inventory",
        children: [
          { label: "User Key Inventory", to: "/inventory/keys/user" },
          { label: "Host Key Inventory", to: "/inventory/keys/host" },
          { label: "PGP Key Inventory", to: "/inventory/pgp" },
          { label: "Recently Deleted Keys", to: "/inventory/keys/deleted" },
          { label: "Recently Rotated Keys", to: "/inventory/keys/rotated" },
        ],
      },
      {
        label: "Certificate Inventory",
        children: [
          { label: "User Certificate Inventory", to: "/inventory/certificates/user" },
          { label: "Host Certificate Inventory", to: "/inventory/certificates/host" },
          { label: "Recently Deleted Certificates", to: "/inventory/certificates/deleted" },
          { label: "Recently Rotated Certificates", to: "/inventory/certificates/rotated" },
        ],
      },
      { label: "Host Inventory", to: "/inventory/hosts" },
    ],
  },
  {
    header: "Groups",
    icon: Copy,
    defaultOpen: true,
    items: [
      { label: "Host Compliance Group", to: "/groups/host" },
      { label: "Key Compliance Group", to: "/groups/key" },
      { label: "Infra Access Group", to: "/groups/infra" },
    ],
  },
  {
    header: "Policies",
    icon: Shield,
    defaultOpen: true,
    items: [
      { label: "Host Policy", to: "/policies/host" },
      { label: "Key Policy", to: "/policies/key" },
    ],
  },
  {
    header: "Administration",
    icon: SlidersHorizontal,
    defaultOpen: false,
    items: [
      { label: "Certificate Authority", to: "/administration/ca" },
      { label: "PGP Settings", to: "/administration/pgp" },
      { label: "Tags", to: "/administration/tags" },
    ],
  },
];

/** A route belongs to a menu entry when it is that path or a page beneath it. */
const matches = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);
const itemActive = (pathname: string, item: NavItem) =>
  item.to ? matches(pathname, item.to) : !!item.children?.some((c) => matches(pathname, c.to));
const sectionActive = (pathname: string, s: Section) =>
  s.to ? matches(pathname, s.to) : !!s.items?.some((i) => itemActive(pathname, i));

const NAV_BG = "#2B3245";
const NAV_ACTIVE = "#3D4659";

function Flyout({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = itemActive(pathname, item);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      setTop(r.top);
      setLeft(r.right + 4);
    }
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        onClick={show}
        className={cn(
          "mx-2 flex h-10 w-[calc(100%-16px)] items-center rounded-md pl-[42px] pr-3 text-left text-[14px] text-white/85 transition-colors hover:text-white",
          (active || open) && "text-white",
        )}
        style={{ background: active || open ? NAV_ACTIVE : undefined }}
      >
        <span className="truncate">{item.label}</span>
        <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/45" />
      </button>
      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed z-[100] min-w-[244px] rounded-md py-2 shadow-xl"
            style={{ top, left, background: NAV_BG }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {item.children?.map((c) => {
              const on = matches(pathname, c.to);
              return (
                <Link
                  key={c.to}
                  to={c.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "mx-2 block rounded-md px-4 py-2.5 text-[14px] transition-colors",
                    on ? "font-medium text-white" : "text-white/85 hover:text-white",
                  )}
                  style={{ background: on ? NAV_ACTIVE : undefined }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) =>
                    (e.currentTarget.style.background = NAV_ACTIVE)
                  }
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) =>
                    (e.currentTarget.style.background = on ? NAV_ACTIVE : "transparent")
                  }
                >
                  {c.label}
                </Link>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { pathname } = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV.map((s) => [s.header, s.defaultOpen ?? true])),
  );
  // Keep the section holding the current page open.
  useEffect(() => {
    const s = NAV.find((x) => x.items && sectionActive(pathname, x));
    if (s && !openSections[s.header]) setOpenSections((p) => ({ ...p, [s.header]: true }));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside
      className={cn(
        "relative shrink-0 text-white transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[256px]",
      )}
      style={{ background: NAV_BG }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        className="absolute -right-[15px] top-[22px] z-30 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border bg-white shadow-sm hover:bg-muted"
      >
        <ChevronLeft
          className={cn("h-4 w-4 text-[#4B5563] transition-transform", collapsed && "rotate-180")}
        />
      </button>

      <div className="flex h-full flex-col">
        <div
          className={cn(
            "flex h-[64px] items-center",
            collapsed ? "justify-center" : "justify-between px-5",
          )}
        >
          <span
            className={cn("font-bold tracking-tight", collapsed ? "text-[16px]" : "text-[22px]")}
          >
            SSH
          </span>
          {!collapsed && (
            <button className="rounded p-1.5 hover:bg-white/10" aria-label="Search menu">
              <Search className="h-[18px] w-[18px] text-white/80" />
            </button>
          )}
        </div>

        <nav className="nav-scroll flex-1 overflow-y-auto pb-4">
          {NAV.map((s) => {
            const Icon = s.icon;
            const active = sectionActive(pathname, s);
            const firstLink =
              s.to ?? s.items?.[0]?.to ?? s.items?.[0]?.children?.[0]?.to ?? "/dashboard";

            if (collapsed) {
              return (
                <Link
                  key={s.header}
                  to={firstLink}
                  title={s.header}
                  className="mx-2 my-0.5 flex h-11 items-center justify-center rounded-md hover:bg-white/10"
                  style={{ background: active ? NAV_ACTIVE : undefined }}
                >
                  <Icon className="h-[19px] w-[19px] text-white/90" strokeWidth={1.75} />
                </Link>
              );
            }

            if (s.to) {
              return (
                <Link
                  key={s.header}
                  to={s.to}
                  className="mx-2 my-0.5 flex h-11 items-center gap-3 rounded-md px-3 text-[13.5px] font-semibold uppercase tracking-[0.08em] text-white/90 hover:bg-white/5 hover:text-white"
                  style={{ background: active ? NAV_ACTIVE : undefined }}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
                  {s.header}
                </Link>
              );
            }

            const isOpen = openSections[s.header];
            return (
              <div key={s.header} className="mt-1">
                <button
                  type="button"
                  onClick={() => setOpenSections((p) => ({ ...p, [s.header]: !p[s.header] }))}
                  className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-md px-3 text-[13.5px] font-semibold uppercase tracking-[0.08em] text-white/90 hover:bg-white/5 hover:text-white"
                  aria-expanded={isOpen}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
                  {s.header}
                  {isOpen ? (
                    <Minus className="ml-auto h-3.5 w-3.5 text-white/80" />
                  ) : (
                    <Plus className="ml-auto h-3.5 w-3.5 text-white/80" />
                  )}
                </button>
                {isOpen && (
                  <div className="pb-1">
                    {s.items?.map((item) =>
                      item.children ? (
                        <Flyout key={item.label} item={item} pathname={pathname} />
                      ) : (
                        <Link
                          key={item.label}
                          to={item.to!}
                          className={cn(
                            "mx-2 flex h-10 items-center rounded-md pl-[42px] pr-3 text-[14px] transition-colors hover:text-white",
                            itemActive(pathname, item) ? "font-medium text-white" : "text-white/85",
                          )}
                          style={{
                            background: itemActive(pathname, item) ? NAV_ACTIVE : undefined,
                          }}
                        >
                          {item.label}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
