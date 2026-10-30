import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fmtDate, type KeyPolicy, type OwnKey, type PgpKey, type PgpPolicy, type Purpose } from "@/data/pgp";
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

// ─── Tones ─────────────────────────────────────────────────────────────────────

type Tone = "green" | "amber" | "red" | "grey" | "purple";
const TONE: Record<Tone, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-[#E7F6EC]", text: "text-[#15803D]", dot: "bg-[#16A34A]" },
  amber: { bg: "bg-[#FDF3D7]", text: "text-[#A16207]", dot: "bg-[#D4A017]" },
  red: { bg: "bg-[#FDECEC]", text: "text-[#DC2626]", dot: "bg-[#DC2626]" },
  grey: { bg: "bg-[#EDEFF3]", text: "text-[#4B5563]", dot: "bg-[#6B7280]" },
  purple: { bg: "bg-[#ECEAFB]", text: "text-primary", dot: "bg-primary" },
};

/** Tinted pill with a leading dot, used for status, management, compliance and publication. */
export function DotPill({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  const t = TONE[tone];
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-[3px] text-[12.5px] font-medium leading-none", t.bg, t.text)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

/** Tinted pill without a dot, used for risks. */
export function TintPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONE[tone];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded px-2 py-[3px] text-[12.5px] font-medium leading-none", t.bg, t.text)}>{children}</span>;
}

export const STATUS_TONE: Record<KeyStatus, Tone> = {
  Active: "green",
  Expiring: "amber",
  Expired: "red",
  Revoked: "red",
  Retired: "grey",
};

export function StatusBadge({ status }: { status: KeyStatus }) {
  return <DotPill tone={STATUS_TONE[status]}>{status}</DotPill>;
}

/** Bordered chip used for purposes. */
export function Pill({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-[3px] border border-[#D1D5DB] bg-white px-2 py-[2px] text-[12.5px] leading-[16px] text-[#1F2937]", className)}>
      {children}
    </span>
  );
}

const RED_RISKS = ["Expired", "Revoked but present", "Rogue", "Misplaced", "Untrusted repository", "Subkey expired"];

export function RiskList({ risks }: { risks: string[] }) {
  if (!risks.length) return <span className="text-[13px] text-[#9CA3AF]">None</span>;
  return (
    <div className="flex items-center gap-1.5">
      {risks.map((r) => (
        <Tooltip key={r}>
          <TooltipTrigger asChild>
            <span>
              <TintPill tone={RED_RISKS.includes(r) ? "red" : "amber"}>{r}</TintPill>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{RISK_HELP[r]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function ComplianceCell({ c }: { c: Compliance }) {
  if (c.state === "Compliant") return <DotPill tone="green">Compliant</DotPill>;
  if (c.state === "Not evaluated") return <DotPill tone="grey">Not evaluated</DotPill>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">
          <DotPill tone="red">Non-compliant</DotPill>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-xs">
        <ul className="list-disc space-y-0.5 pl-4">
          {c.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function ManagementPill({ k }: { k: OwnKey }) {
  return <DotPill tone={k.management === "Managed" ? "purple" : "grey"}>{k.management}</DotPill>;
}

/** Number of hosts in a filled circle; zero is shown plain. */
export function HostCount({ n }: { n: number }) {
  if (n === 0) return <span className="pl-1.5 text-[13px] text-[#9CA3AF]">0</span>;
  return <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11.5px] font-semibold text-white">{n}</span>;
}

export function StorageCell({ storage }: { storage: OwnKey["storage"] }) {
  if (storage === "CyberArk")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px]">
        <Lock className="h-3.5 w-3.5 text-primary" /> CyberArk
      </span>
    );
  return <span className="text-[13px]">{storage}</span>;
}

export function NextExpiryCell({ k, status }: { k: PgpKey; status: KeyStatus }) {
  const d = nextExpiryDisplay(k, status);
  if (d.kind === "blank") return <span className="text-[#6B7280]">—</span>;
  if (d.kind === "none") return <span className="text-[13px] text-[#6B7280]">No expiry</span>;
  return (
    <span className="text-[13px]" title={d.days === 0 ? "Expires today" : `${d.days} days from today`}>
      {fmtDate(d.date)}
    </span>
  );
}

export function PurposeList({ list }: { list: Purpose[] }) {
  if (!list.length) return <span className="text-[13px] text-[#9CA3AF]">None</span>;
  return (
    <div className="flex gap-1">
      {list.map((p) => (
        <Pill key={p}>{p === "Authenticate" ? "Auth" : p}</Pill>
      ))}
    </div>
  );
}

/** Label on the left, value on the right; used in the key details panel. */
export function KV({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-[30px] items-center justify-between gap-6 py-1", className)}>
      <div className="shrink-0 text-[13.5px] text-[#4B5563]">{label}</div>
      <div className="min-w-0 text-right text-[13.5px] text-[#111827]">{value}</div>
    </div>
  );
}

/** A menu item that is greyed out with a tooltip explaining why, or clickable when available. */
export function ActionItem({ label, avail, onSelect, className, icon }: { label: string; avail: Availability; onSelect: () => void; className?: string; icon?: ReactNode }) {
  const body = (
    <>
      <span className="flex w-4 justify-center text-[#4B5563]">{icon}</span>
      <span>{label}</span>
    </>
  );
  if (!avail.ok)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <DropdownMenuItem disabled className="w-full gap-2.5 px-3 py-[7px] text-[13.5px]">
              {body}
            </DropdownMenuItem>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs">
          {avail.reason}
        </TooltipContent>
      </Tooltip>
    );
  return (
    <DropdownMenuItem onClick={onSelect} className={cn("gap-2.5 px-3 py-[7px] text-[13.5px]", className)}>
      {body}
    </DropdownMenuItem>
  );
}

export function MenuGroupLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#4B5563]">{children}</div>;
}

export interface Derived {
  status: KeyStatus;
  risks: string[];
  purposes: Purpose[];
  policy: PgpPolicy;
  compliance?: Compliance;
}

export function derive(k: PgpKey, policies: KeyPolicy[]): Derived {
  const policy = policyFor(k.group, policies);
  const status = keyStatus(k, policy.expiringThreshold);
  if (k.kind === "own") return { status, policy, risks: ownRisks(k, policy), purposes: purposes(k, status), compliance: compliance(k, policy) };
  return { status, policy, risks: trustedRisks(k, policy), purposes: purposes(k, status) };
}

/** Section in the key details panel: title, optional action on the right, content below. */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-border px-6 py-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-medium text-[#111827]">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Bordered table used inside the key details panel. */
export function PanelTable({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-[13.5px]">
        <thead className="bg-[#EEF1F8] text-left text-[#374151]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[#EDEFF3] align-middle">
              {r.map((c, j) => (
                <td key={j} className="px-3.5 py-2.5">
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-3.5 py-4 text-center text-[#6B7280]">
                {empty ?? "None"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
