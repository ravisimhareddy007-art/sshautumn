import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fmtDate, type PgpKey, type PgpPolicy, type Purpose } from "@/data/pgp";
import {
  RISK_HELP,
  compliance,
  keyStatus,
  nextExpiryDisplay,
  ownRisks,
  policyFor,
  purposes,
  trustedRisks,
  type Availability,
  type Compliance,
  type KeyStatus,
} from "@/lib/pgp-rules";

export const STATUS_CLASS: Record<KeyStatus, string> = {
  Active: "bg-risk-green/10 text-[#15803D] border-risk-green/30",
  Expiring: "bg-risk-amber/10 text-[#B45309] border-risk-amber/40",
  Expired: "bg-risk-red/10 text-risk-red border-risk-red/30",
  Revoked: "bg-[#F1F5F9] text-[#7F1D1D] border-[#FCA5A5]",
  Retired: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: KeyStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
        STATUS_CLASS[status],
      )}
    >
      {status}
    </span>
  );
}

export function Pill({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

const RED_RISKS = [
  "Expired",
  "Revoked but present",
  "Rogue",
  "Misplaced",
  "Weak",
  "Untrusted repository",
  "Subkey expired",
];

export function RiskList({ risks }: { risks: string[] }) {
  if (!risks.length) return <span className="text-[12px] text-muted-foreground">None</span>;
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {risks.map((r) => (
        <Tooltip key={r}>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap border",
                RED_RISKS.includes(r)
                  ? "bg-risk-red/10 text-risk-red border-risk-red/30"
                  : "bg-risk-amber/10 text-[#B45309] border-risk-amber/40",
              )}
            >
              {r}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{RISK_HELP[r]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function ComplianceCell({ c }: { c: Compliance }) {
  if (c.state === "Compliant")
    return <span className="text-[12px] font-medium text-[#15803D]">Compliant</span>;
  if (c.state === "Not evaluated")
    return (
      <span
        className="text-[12px] text-muted-foreground"
        title="Evaluate PGP Keys is off in the key policy"
      >
        Not evaluated
      </span>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-[12px] font-medium text-risk-red cursor-help underline decoration-dotted">
          Non-Compliant ({c.reasons.length})
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-xs">
        <ul className="list-disc pl-4 space-y-0.5">
          {c.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function NextExpiryCell({ k, status }: { k: PgpKey; status: KeyStatus }) {
  const d = nextExpiryDisplay(k, status);
  if (d.kind === "blank") return <span className="text-muted-foreground"> </span>;
  if (d.kind === "none")
    return <span className="text-[12px] text-muted-foreground">No expiry</span>;
  return (
    <span className={cn("text-[12px]", status === "Expiring" && "text-[#B45309] font-medium")}>
      {fmtDate(d.date)}{" "}
      <span className="text-muted-foreground">({d.days === 0 ? "today" : `${d.days}d`})</span>
    </span>
  );
}

export function PurposeList({ list }: { list: Purpose[] }) {
  if (!list.length) return <span className="text-[12px] text-muted-foreground">None</span>;
  return (
    <div className="flex gap-1">
      {list.map((p) => (
        <Pill key={p}>{p}</Pill>
      ))}
    </div>
  );
}

export function KV({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase-tracking text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[12px] break-words">{value}</div>
    </div>
  );
}

/** A menu item that is greyed out with a tooltip explaining why, or clickable when available. */
export function ActionItem({
  label,
  avail,
  onSelect,
  className,
  icon,
}: {
  label: string;
  avail: Availability;
  onSelect: () => void;
  className?: string;
  icon?: ReactNode;
}) {
  if (!avail.ok)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <DropdownMenuItem disabled className="w-full">
              {icon}
              <span>{label}</span>
            </DropdownMenuItem>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs">
          {avail.reason}
        </TooltipContent>
      </Tooltip>
    );
  return (
    <DropdownMenuItem onClick={onSelect} className={className}>
      {icon}
      {label}
    </DropdownMenuItem>
  );
}

export interface Derived {
  status: KeyStatus;
  risks: string[];
  purposes: Purpose[];
  policy: PgpPolicy;
  compliance?: Compliance;
}

export function derive(k: PgpKey, policies: PgpPolicy[]): Derived {
  const policy = policyFor(k.group, policies);
  const status = keyStatus(k, policy.expiringThreshold);
  if (k.kind === "own")
    return {
      status,
      policy,
      risks: ownRisks(k, policy),
      purposes: purposes(k, status),
      compliance: compliance(k, policy),
    };
  return { status, policy, risks: trustedRisks(k, policy), purposes: purposes(k, status) };
}

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="border-t border-border pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
