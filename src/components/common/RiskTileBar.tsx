import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskTileDef {
  key: string;
  label: string;
  count: number;
  total?: number;
  color: "red" | "amber" | "orange" | "green";
  info?: string;
}

const BORDER = { red: "#E5484D", amber: "#D4A017", orange: "#F97316", green: "#22C55E" };

/** Risk tiles in the product style: white card, coloured left edge, large count over its total. */
export function RiskTileBar({
  tiles,
  activeKey,
  onSelect,
}: {
  tiles: RiskTileDef[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  return (
    <div
      className="mb-6 grid gap-4"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((t) => {
        const active = activeKey === t.key;
        return (
          <button
            key={t.key}
            type="button"
            title={t.info}
            onClick={() => onSelect?.(t.key)}
            aria-pressed={active}
            className={cn(
              "rounded-md border border-border bg-white px-5 py-4 text-left transition-colors hover:bg-[#F9FAFB]",
              active && "bg-row-selected ring-1 ring-primary/40",
            )}
            style={{
              borderLeftWidth: 3,
              borderLeftColor: BORDER[t.count === 0 ? "green" : t.color],
            }}
          >
            <div className="flex items-baseline">
              <span className="text-[30px] font-semibold leading-none text-[#111827]">
                {t.count}
              </span>
              {t.total != null && (
                <span className="ml-0.5 text-[14px] text-[#6B7280]">/{t.total}</span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-1 whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.06em] text-[#374151]">
              {t.label}
              {t.info && <Info className="h-3.5 w-3.5 text-[#6B7280]" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
