// PGP pages use the product form style shared with Key Policy and Network Scan.
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  FormRow as ProductRow,
  FormSection as ProductSection,
  PillSwitch,
} from "@/components/common/ProductForm";
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
  if (!isNew && !right) return <ProductSection title={title}>{children}</ProductSection>;
  return (
    <section className="mb-10">
      <div className="mb-7 flex items-center gap-2 border-b border-border pb-3">
        <h2 className="text-[19px] font-semibold text-primary">{title}</h2>
        {isNew && <Badge className="bg-primary px-1.5 text-[10px] text-white">NEW</Badge>}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function FormRow(props: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return <ProductRow {...props} />;
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
    <PillSwitch value={checked} onChange={onChange} disabled={disabled} label={label ?? "Toggle"} />
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
        "rounded border px-3 py-1.5 text-[14px] transition-colors",
        on
          ? "border-primary/40 bg-primary/10 font-medium text-primary"
          : "border-[#D1D5DB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      {children}
    </button>
  );
}
