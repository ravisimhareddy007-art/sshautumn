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

const colorMap = {
  red: { border: "border-l-risk-red", text: "text-risk-red" },
  amber: { border: "border-l-risk-amber", text: "text-risk-amber" },
  orange: { border: "border-l-risk-orange", text: "text-risk-orange" },
  green: { border: "border-l-risk-green", text: "text-risk-green" },
};

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
    <div className="bg-surface border border-border rounded-md flex overflow-hidden mb-4">
      {tiles.map((t, i) => {
        const isZero = t.count === 0;
        const effectiveColor = isZero ? "green" : t.color;
        const c = colorMap[effectiveColor];
        const active = activeKey === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onSelect?.(t.key)}
            className={cn(
              "flex-1 text-left px-5 py-3 border-l-4 transition-colors",
              c.border,
              i > 0 && "border-l border-l-border",
              i > 0 && c.border, // re-apply colored left border via inline style
              active ? "bg-row-selected" : "hover:bg-muted/60",
            )}
            style={{ borderLeftWidth: 4, borderLeftColor: undefined }}
          >
            <div className={cn("text-[28px] font-bold leading-none", c.text)}>
              {t.count}
              {t.total != null && (
                <span className="text-[14px] text-muted-foreground font-normal ml-1">
                  /{t.total}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] uppercase-tracking font-medium text-muted-foreground">
              {t.label}
              {t.info && <Info className="h-3 w-3" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
