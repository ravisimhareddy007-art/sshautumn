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
    <div className="sticky top-0 z-20 -mx-8 mb-6 border-b border-border bg-white px-8">
      <div className="flex min-h-[64px] items-center justify-between gap-4 py-3">
        {parents?.length ? (
          <div className="flex items-center gap-2">
            {parents.map((p) => (
              <span key={p.to} className="flex items-center gap-2">
                <Link
                  to={p.to}
                  search={p.search as never}
                  className="text-[15px] text-primary hover:underline"
                >
                  {p.label}
                </Link>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </span>
            ))}
            <h1 className="text-[20px] font-semibold text-[#111827]">{title}</h1>
          </div>
        ) : (
          <h1 className="text-[20px] font-semibold text-[#111827]">{title}</h1>
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="-mb-px flex gap-8">{tabs}</div>}
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
          ? "border-b-[3px] border-primary pb-2.5 text-[16px] font-medium text-primary"
          : "border-b-[3px] border-transparent pb-2.5 text-[16px] text-[#111827] hover:text-primary"
      }
    >
      {children}
    </button>
  );
}
