// Form building blocks that match the AVX SSH product forms (Key Policy, Network Scan, settings pages):
// blue section titles with a rule, right-aligned labels, 40px inputs, italic hints.
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, Info, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-white px-10 py-8", className)}>
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-10", className)}>
      <h2 className="mb-6 border-b border-border pb-2.5 text-[17px] font-semibold text-primary">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function FormRow({
  label,
  required,
  hint,
  error,
  info,
  disabled,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  info?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[260px_minmax(0,576px)_28px] items-start gap-x-5">
      <label
        className={cn("pt-2 text-right text-[14px] text-[#1F2937]", disabled && "text-[#9CA3AF]")}
      >
        {required && <span className="mr-1 text-risk-red">*</span>}
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {error ? (
          <p className="mt-1 text-[12.5px] text-risk-red">{error}</p>
        ) : (
          hint && (
            <p
              className={cn(
                "mt-1 text-[12.5px] italic leading-snug text-[#6B7280]",
                disabled && "text-[#9CA3AF]",
              )}
            >
              {hint}
            </p>
          )
        )}
      </div>
      <div className="pt-2">
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="text-[#6B7280] hover:text-[#374151]"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

const inputBase =
  "h-[38px] w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  invalid,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputBase, invalid && "border-risk-red", className)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <textarea
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="w-full resize-y rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[14px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, "appearance-none pr-9")}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4B5563]" />
    </div>
  );
}

/** Chips with remove buttons plus a dropdown to add more, shown on a grey field. */
export function TagInput({
  values,
  options,
  onChange,
  placeholder = "Select...",
  disabled,
  invalid,
  ariaLabel,
  render = (v) => v,
}: {
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  render?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const remaining = options.filter((o) => !values.includes(o));
  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        className={cn(
          "flex min-h-[46px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-2",
          disabled && "cursor-not-allowed opacity-60",
          invalid && "border-risk-red",
          open && "border-primary ring-2 ring-primary/20",
        )}
      >
        {values.length === 0 && (
          <span className="px-1 text-[14px] text-[#9CA3AF]">{placeholder}</span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded bg-[#E5E7EB] px-2 py-0.5 text-[13px] text-[#374151]"
          >
            {render(v)}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${render(v)}`}
                className="text-[#4B5563] hover:text-[#111827]"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(values.filter((x) => x !== v));
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg"
          role="listbox"
        >
          {remaining.length === 0 ? (
            <div className="px-3 py-2 text-[14px] text-[#6B7280]">All options are selected</div>
          ) : (
            remaining.map((o) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={false}
                className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[#F3F4F6]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange([...values, o])}
              >
                {render(o)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** On/Off button used for PGP policy switches. */
export function OnOff({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "h-8 w-[70px] rounded-md border text-[14px] font-medium transition-colors",
        value
          ? "border-primary bg-primary text-white"
          : "border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {value ? "On" : "Off"}
    </button>
  );
}

/** Small grey pill switch used for SSH toggles. */
export function PillSwitch({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "relative mt-2 h-[20px] w-[40px] rounded-full transition-colors",
        value ? "bg-primary" : "bg-[#9CA3AF]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all",
          value ? "left-[22px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

export function RadioGroupRow<T extends string>({
  value,
  onChange,
  options,
  name,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  name: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex min-h-[38px] flex-wrap items-center gap-x-9 gap-y-2"
      role="radiogroup"
      aria-label={name}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-[14px] text-[#1F2937]",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={disabled}
            onChange={() => onChange(o.value)}
            className="h-4 w-4 accent-primary"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function CheckRow({
  items,
}: {
  items: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }[];
}) {
  return (
    <div className="flex min-h-[38px] flex-wrap items-center gap-x-7 gap-y-2">
      {items.map((i) => (
        <label
          key={i.label}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-[14px] text-[#1F2937]",
            i.disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="checkbox"
            checked={i.checked}
            disabled={i.disabled}
            onChange={(e) => i.onChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {i.label}
        </label>
      ))}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex justify-center gap-4 pt-2">{children}</div>;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-9 min-w-[88px] rounded-md bg-primary px-5 text-[14px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 min-w-[88px] rounded-md border border-[#D1D5DB] bg-white px-5 text-[14px] text-[#1F2937] hover:bg-[#F9FAFB]"
    >
      {children}
    </button>
  );
}

/** Chips plus a text box: pick a suggestion or type a new value and press Enter. */
export function FreeTagInput({
  values,
  onChange,
  suggestions = [],
  placeholder = "Select....",
  invalid,
  ariaLabel,
  mono,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  invalid?: boolean;
  ariaLabel?: string;
  mono?: boolean;
}) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const add = (v: string) => {
    const t = v.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setText("");
  };
  const matches = suggestions.filter(
    (o) => !values.includes(o) && o.toLowerCase().includes(text.trim().toLowerCase()),
  );
  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-[46px] w-full flex-wrap items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-2",
          invalid && "border-risk-red",
          focus && "border-primary ring-2 ring-primary/20",
        )}
      >
        {values.map((v) => (
          <span
            key={v}
            className={cn(
              "inline-flex items-center gap-1.5 rounded bg-[#E5E7EB] px-2 py-0.5 text-[13px] text-[#374151]",
              mono && "font-mono text-[13px]",
            )}
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              className="text-[#4B5563] hover:text-[#111827]"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          aria-label={ariaLabel}
          value={text}
          placeholder={values.length ? "" : placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 120)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            }
            if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
          }}
          className={cn(
            "min-w-[140px] flex-1 bg-transparent px-1 text-[14px] placeholder:text-[#9CA3AF] focus:outline-none",
            mono && "font-mono text-[14px]",
          )}
        />
      </div>
      {focus && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {matches.map((o) => (
            <button
              key={o}
              type="button"
              className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[#F3F4F6]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-[#F5E3B3] bg-[#FDF3D8] px-4 py-2.5 text-[13.5px] leading-snug text-[#5C4813]">
      {children}
    </div>
  );
}
