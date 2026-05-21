import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function FilterChips({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: { key: string; label: string }[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      {chips.map((c) => (
        <Badge
          key={c.key}
          variant="outline"
          className="gap-1 bg-row-selected border-primary/40 text-foreground"
        >
          {c.label}
          <button
            onClick={() => onRemove(c.key)}
            className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {chips.length > 0 && onClearAll && (
        <button
          onClick={onClearAll}
          className="text-[12px] text-muted-foreground hover:text-foreground underline"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
