import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import {
  Key, AlertTriangle, RefreshCw, FileText, Shield, Terminal,
  CheckCircle, Clock,
} from "lucide-react";

interface McpTool {
  name: string;
  label: string;
  description: string;
  type: "Query" | "Action";
  enabled: boolean;
  transport: string[];
  lastCalled: string | null;
  callCount: number;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
}

const INITIAL_TOOLS: McpTool[] = [
  {
    name: "ssh_query_key_inventory",
    label: "ssh_query_key_inventory",
    description:
      "Query SSH key inventory with server-side filtering, pagination, and structured metadata. Supports filters: key type, bit length, host, user, environment, date ranges, compliance status.",
    type: "Query",
    enabled: true,
    transport: ["SSE", "STDIO"],
    lastCalled: "2026-05-22 00:14:03",
    callCount: 47,
    icon: <Key className="w-3.5 h-3.5" />,
    color: "text-blue-400",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
  },
  {
    name: "ssh_query_risky_keys",
    label: "ssh_query_risky_keys",
    description:
      "Surface SSH keys with active risk violations. Violation types: ROGUE, ORPHANED, SHARED, STALE, POLICY_VIOLATION. Returns severity, policy ID, and remediation recommendation per record.",
    type: "Query",
    enabled: true,
    transport: ["SSE", "STDIO"],
    lastCalled: "2026-05-22 00:13:51",
    callCount: 31,
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-red-400",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
  },
  {
    name: "ssh_rotate_key",
    label: "ssh_rotate_key",
    description:
      "Trigger async SSH key rotation for one or more keys. Accepts UUID array and key type. Returns operationId immediately. Use ssh_get_rotation_status to poll for completion.",
    type: "Action",
    enabled: true,
    transport: ["SSE", "STDIO"],
    lastCalled: "2026-05-22 00:12:10",
    callCount: 8,
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    color: "text-amber-400",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
  },
  {
    name: "ssh_query_certificate_inventory",
    label: "ssh_query_certificate_inventory",
    description:
      "Query SSH certificate inventory. Supports user and host certificate types. Filters: CA, principal, expiry window, compliance status. Returns principals, serial, extensions — not TLS/X.509.",
    type: "Query",
    enabled: true,
    transport: ["SSE", "STDIO"],
    lastCalled: "2026-05-22 00:11:44",
    callCount: 19,
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "text-teal-400",
    border: "border-teal-500/40",
    bg: "bg-teal-500/10",
  },
  {
    name: "ssh_query_risky_certificates",
    label: "ssh_query_risky_certificates",
    description:
      "Surface SSH certificates with active risk conditions. Risk types: EXPIRING_SOON (1hr resolution), EXPIRED, REVOKED (KRL / platform / CA compromise), POLICY_VIOLATION. Returns renewalEligible flag.",
    type: "Query",
    enabled: true,
    transport: ["SSE", "STDIO"],
    lastCalled: "2026-05-22 00:11:02",
    callCount: 23,
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "text-orange-400",
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
  },
  {
    name: "ssh_renew_certificate",
    label: "ssh_renew_certificate",
    description:
      "Trigger async SSH certificate renewal. CA re-signs with current IAM principal bindings. Returns operationId. Old certificate invalidated via KRL on success. Use ssh_get_certificate_renewal_status to poll.",
    type: "Action",
    enabled: true,
    transport: ["SSE", "STDIO"],
    lastCalled: "2026-05-22 00:09:33",
    callCount: 5,
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    color: "text-purple-400",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
  },
];

export default function McpToolsPage() {
  const [tools, setTools] = useState(INITIAL_TOOLS);

  const toggleTool = (name: string) => {
    setTools((prev) =>
      prev.map((t) => (t.name === name ? { ...t, enabled: !t.enabled } : t)),
    );
  };

  const enabledCount = tools.filter((t) => t.enabled).length;
  const totalCalls = tools.reduce((sum, t) => sum + t.callCount, 0);

  return (
    <div>
      <PageHeader
        title="MCP Tools"
        subtitle="Model Context Protocol tool manifest exposed to the agent runtime."
        right={
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Terminal className="w-3.5 h-3.5" />
            <span>MCP spec 2025-06-18</span>
            <span className="opacity-40">|</span>
            <span>SSE + STDIO</span>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Tools Available", value: tools.length, sub: "SSH Lifecycle Management" },
          { label: "Tools Enabled", value: enabledCount, sub: `${tools.length - enabledCount} disabled` },
          { label: "Total Agent Calls", value: totalCalls, sub: "across all tools" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/50 bg-card/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold text-foreground mt-1">{s.value}</div>
            <div className="text-[11px] text-muted-foreground/70 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tool table */}
      <div className="rounded-lg border border-border/50 bg-card/40 overflow-hidden">
        <div className="grid grid-cols-[2.4fr_0.7fr_0.9fr_1fr_0.8fr_0.6fr] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-muted/20">
          <div>Tool</div>
          <div>Type</div>
          <div>Transport</div>
          <div>Last Called</div>
          <div>Total Calls</div>
          <div className="text-right">Enabled</div>
        </div>

        {tools.map((tool) => (
          <div key={tool.name} className="border-b border-border/30 last:border-b-0">
            {/* Main row */}
            <div className="grid grid-cols-[2.4fr_0.7fr_0.9fr_1fr_0.8fr_0.6fr] gap-3 px-4 py-3 items-start">
              {/* Tool name + description */}
              <div>
                <div className={cn("flex items-center gap-2 font-mono text-[12px]", tool.color)}>
                  {tool.icon}
                  <span>{tool.label}</span>
                </div>
                <div className="text-[11px] text-muted-foreground/80 mt-1 leading-relaxed">
                  {tool.description}
                </div>
              </div>

              {/* Type */}
              <div>
                <span
                  className={cn(
                    "inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium",
                    tool.type === "Action"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-blue-500/40 bg-blue-500/10 text-blue-400",
                  )}
                >
                  {tool.type}
                </span>
              </div>

              {/* Transport */}
              <div className="flex flex-wrap gap-1">
                {tool.transport.map((t) => (
                  <span
                    key={t}
                    className="inline-flex px-1.5 py-0.5 rounded border border-border/50 bg-muted/30 text-[10px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Last called */}
              <div>
                {tool.lastCalled ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{tool.lastCalled.split(" ")[1]}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground/50">Never</span>
                )}
              </div>

              {/* Call count */}
              <div>
                <div className="text-[13px] text-foreground">{tool.callCount}</div>
                <div className="text-[10px] text-muted-foreground/60">calls</div>
              </div>

              {/* Toggle */}
              <div className="flex justify-end">
                <button
                  onClick={() => toggleTool(tool.name)}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                    tool.enabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      tool.enabled ? "translate-x-5" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Status bar */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 text-[10px] border-t border-border/20",
                tool.enabled ? "bg-emerald-500/5 text-emerald-400" : "bg-muted/20 text-muted-foreground/60",
              )}
            >
              <CheckCircle className="w-3 h-3" />
              <span>
                {tool.enabled
                  ? "Active — accepting tool/call requests"
                  : "Disabled — tool not exposed in manifest"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground/70">
        All tools enforce RBAC and produce audit log entries on every invocation. Private key material is never exposed in any tool response.
      </div>
    </div>
  );
}
