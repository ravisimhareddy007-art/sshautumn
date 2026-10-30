// Toolbar pieces shared by list pages: search, outline buttons, pager and refresh.
import { useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBox({
  value,
  onChange,
  placeholder = "Search...",
  withFilter,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  withFilter?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6B7280]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="h-10 w-full rounded-md border border-[#D1D5DB] bg-white pl-10 pr-10 text-[15px] placeholder:text-[#9CA3AF] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {withFilter && (
        <SlidersHorizontal className="absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
      )}
    </div>
  );
}

export const toolbarButton =
  "inline-flex h-10 items-center gap-2 rounded-md border border-[#D1D5DB] bg-white px-4 text-[15px] text-[#1F2937] hover:bg-[#F9FAFB] disabled:opacity-50";

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onRefresh,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onRefresh?: () => void;
}) {
  const [spinning, setSpinning] = useState(false);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 items-center whitespace-nowrap rounded-md border border-[#D1D5DB] px-4 text-[15px] text-[#374151]">
        {from} to {to} of {total}
      </div>
      <div className="flex h-10 overflow-hidden rounded-md border border-[#D1D5DB]">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex w-9 items-center justify-center hover:bg-[#F9FAFB] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= last}
          onClick={() => onPage(page + 1)}
          className="flex w-9 items-center justify-center border-l border-[#D1D5DB] hover:bg-[#F9FAFB] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Refresh"
        onClick={() => {
          setSpinning(true);
          onRefresh?.();
          setTimeout(() => setSpinning(false), 600);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-[#F3F4F6]"
      >
        <RefreshCw className={cn("h-[18px] w-[18px] text-[#374151]", spinning && "animate-spin")} />
      </button>
    </div>
  );
}

/** Column header label with the sort icon used across list pages. */
export function SortHeader({
  children,
  onClick,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 font-medium", active && "text-primary")}
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 text-[#6B7280]" />
    </button>
  );
}

/** Sorts rows by a string or number key, toggling direction on repeat clicks. */
export function useSort<T>(
  rows: T[],
  initial: { key: string; get: (r: T) => string | number } | null = null,
) {
  const [sort, setSort] = useState<{
    key: string;
    dir: 1 | -1;
    get: (r: T) => string | number;
  } | null>(initial ? { ...initial, dir: 1 } : null);
  const sorted = sort
    ? [...rows].sort((a, b) => {
        const x = sort.get(a);
        const y = sort.get(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      })
    : rows;
  const by = (key: string, get: (r: T) => string | number) =>
    setSort((s) =>
      s && s.key === key ? { ...s, dir: s.dir === 1 ? -1 : 1 } : { key, get, dir: 1 },
    );
  return { sorted, by, sortKey: sort?.key };
}
