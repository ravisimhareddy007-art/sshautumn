import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  isNew,
  children,
  right,
}: {
  title: string;
  isNew?: boolean;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        {isNew && <Badge className="text-[9px] bg-primary text-white px-1.5">NEW</Badge>}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export function FormRow({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[240px_1fr] gap-6 py-3 items-start">
      <div className="flex items-center gap-1 pt-2">
        {required && <span className="text-destructive text-[13px]">*</span>}
        <span className="text-[12px] font-medium text-foreground">{label}</span>
      </div>
      <div className="min-w-0">
        {children}
        {error && <p className="text-[11px] text-risk-red mt-1.5">{error}</p>}
        {hint && !error && (
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-10 h-6 rounded-full relative transition-colors shrink-0",
        checked ? "bg-primary" : "bg-muted",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function ChipToggle({
  on,
  onClick,
  children,
  disabled,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded border text-[12px] transition-colors",
        on
          ? "bg-primary/10 border-primary/40 text-primary font-medium"
          : "bg-surface border-border text-foreground hover:bg-muted",
        disabled && "opacity-70 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}
