import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * White header bar at the top of every page. Shows the page title, or a trail such as
 * "Key Policy > Add" when `parents` is given, plus optional actions and tabs.
 * `breadcrumbs` is accepted for older callers and is not rendered.
 */
export function PageHeader({
  title,
  parents,
  actions,
  tabs,
}: {
  breadcrumbs?: string[];
  title: string;
  parents?: { label: string; to: string; search?: Record<string, unknown> }[];
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-6 mb-6 border-b border-border bg-white px-6">
      <div className="flex min-h-[52px] items-center justify-between gap-4 py-2.5">
        {parents?.length ? (
          <div className="flex items-center gap-2">
            {parents.map((p) => (
              <span key={p.to} className="flex items-center gap-2">
                <Link
                  to={p.to}
                  search={p.search as never}
                  className="text-[13px] text-primary hover:underline"
                >
                  {p.label}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            ))}
            <h1 className="text-[16px] font-semibold text-[#111827]">{title}</h1>
          </div>
        ) : (
          <h1 className="text-[16px] font-semibold text-[#111827]">{title}</h1>
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="-mb-px flex gap-6">{tabs}</div>}
    </div>
  );
}

/** Underlined tab used in page headers. */
export function HeaderTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-primary pb-2 text-[14px] text-primary"
          : "border-b-2 border-transparent pb-2 text-[14px] text-[#111827] hover:text-primary"
      }
    >
      {children}
    </button>
  );
}
