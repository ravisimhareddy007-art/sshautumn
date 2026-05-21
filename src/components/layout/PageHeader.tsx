import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  breadcrumbs,
  title,
  actions,
}: {
  breadcrumbs: string[];
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center text-[11px] uppercase-tracking text-muted-foreground gap-1">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span>{b}</span>
            </span>
          ))}
        </div>
        <h1 className="text-[18px] font-semibold text-foreground mt-1">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
