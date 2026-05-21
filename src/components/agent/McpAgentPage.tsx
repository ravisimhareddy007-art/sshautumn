import { useState, useRef, useEffect } from "react";
import { Send, Terminal, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  USER_KEYS, HOST_KEYS, USER_CERTS, HOST_CERTS,
  type SshKey, type SshCert,
} from "@/data/mock";
import { PageHeader } from "@/components/layout/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolName =
  | "ssh_query_key_inventory"
  | "ssh_query_risky_keys"
  | "ssh_rotate_key"
  | "ssh_query_certificate_inventory"
  | "ssh_query_risky_certificates"
  | "ssh_renew_certificate";

interface ToolCall {
  tool: ToolName;
  params: Record<string, unknown>;
}

type ResultType = "key-list" | "cert-list" | "action" | "error";

interface AgentResponse {
  toolCall: ToolCall;
  summary: string;
  resultType: ResultType;
  keys?: SshKey[];
  certs?: SshCert[];
  actionDetail?: { label: string; value: string }[];
  error?: string;
}

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  ts: string;
}

// ─── Tool colour map ──────────────────────────────────────────────────────────

const TOOL_COLOR: Record<ToolName, { color: string; border: string; bg: string }> = {
  ssh_query_key_inventory:       { color: "text-blue-400",   border: "border-blue-500",   bg: "bg-blue-500/10"   },
  ssh_query_risky_keys:          { color: "text-red-400",    border: "border-red-500",    bg: "bg-red-500/10"    },
  ssh_rotate_key:                { color: "text-amber-400",  border: "border-amber-500",  bg: "bg-amber-500/10"  },
  ssh_query_certificate_inventory:{ color: "text-teal-400",  border: "border-teal-500",   bg: "bg-teal-500/10"   },
  ssh_query_risky_certificates:  { color: "text-orange-400", border: "border-orange-500", bg: "bg-orange-500/10" },
  ssh_renew_certificate:         { color: "text-purple-400", border: "border-purple-500", bg: "bg-purple-500/10" },
};

// ─── Suggested queries ────────────────────────────────────────────────────────

const SUGGESTED = [
  "Show all rogue keys",
  "Certs expiring soon",
  "Show shared keys",
  "Rotate key Test",
  "Show all risky certs",
  "List all keys",
  "Show expired certs",
  "Show stale keys",
  "Renew cert cert-devops-prod01",
  "Show host certs",
];

// ─── Query engine ─────────────────────────────────────────────────────────────

const ALL_KEYS = [...USER_KEYS, ...HOST_KEYS];
const ALL_CERTS = [...USER_CERTS, ...HOST_CERTS];

function processQuery(input: string): AgentResponse {
  const q = input.toLowerCase().trim();

  // ── ssh_rotate_key ─────────────────────────────────────────────────────────
  const rotateMatch = q.match(/rotate\s+(?:key\s+)?(.+)/);
  if (rotateMatch && !q.includes("all rogue") && !q.includes("all key")) {
    const target = rotateMatch[1].trim();
    const key = ALL_KEYS.find(
      (k) => k.name.toLowerCase() === target || k.id.toLowerCase() === target
    );
    if (!key) {
      return {
        toolCall: { tool: "ssh_rotate_key", params: { uuids: [target], type: "User Keys" } },
        summary: `No key found matching "${target}".`,
        resultType: "error",
        error: `Key "${target}" not found in inventory. Check the key name or ID and retry.`,
      };
    }
    const opId = `OP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return {
      toolCall: { tool: "ssh_rotate_key", params: { uuids: [key.id], type: key.type === "user" ? "User Keys" : "Host Keys" } },
      summary: `Rotation triggered for "${key.name}".`,
      resultType: "action",
      actionDetail: [
        { label: "operationId", value: opId },
        { label: "status", value: "TRIGGERED" },
        { label: "key", value: key.name },
        { label: "type", value: key.type === "user" ? "User Keys" : "Host Keys" },
        { label: "encryption", value: key.encryption },
        { label: "currentRiskStatus", value: key.riskStatus },
      ],
    };
  }

  if (q.includes("rotate all rogue")) {
    const rogues = ALL_KEYS.filter((k) => k.riskStatus === "Rogue");
    const opId = `OP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return {
      toolCall: { tool: "ssh_rotate_key", params: { uuids: rogues.map((k) => k.id), type: "User Keys" } },
      summary: `Bulk rotation triggered for ${rogues.length} rogue keys.`,
      resultType: "action",
      actionDetail: [
        { label: "operationId", value: opId },
        { label: "status", value: "TRIGGERED" },
        { label: "keysAccepted", value: `${rogues.length}` },
        { label: "keysRejected", value: "0" },
        { label: "note", value: "Poll ssh_get_rotation_status with operationId for updates" },
      ],
    };
  }

  // ── ssh_renew_certificate ──────────────────────────────────────────────
  const renewMatch = q.match(/renew\s+(?:cert(?:ificate)?\s+)?(.+)/);
  if (renewMatch && !q.includes("renew all")) {
    const target = renewMatch[1].trim();
    const cert = ALL_CERTS.find(
      (c) => c.certName.toLowerCase() === target || c.id.toLowerCase() === target
    );
    if (!cert) {
      return {
        toolCall: { tool: "ssh_renew_certificate", params: { certificateIds: [target] } },
        summary: `No certificate found matching "${target}".`,
        resultType: "error",
        error: `Certificate "${target}" not found. Check the certificate name or ID and retry.`,
      };
    }
    const opId = `OP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return {
      toolCall: { tool: "ssh_renew_certificate", params: { certificateIds: [cert.id] } },
      summary: `Renewal triggered for "${cert.certName}".`,
      resultType: "action",
      actionDetail: [
        { label: "operationId", value: opId },
        { label: "status", value: "TRIGGERED" },
        { label: "certificate", value: cert.certName },
        { label: "currentExpiry", value: cert.validTo },
        { label: "ca", value: cert.caName },
        { label: "note", value: "Poll ssh_get_certificate_renewal_status with operationId" },
      ],
    };
  }

  if (q.includes("renew all expir")) {
    const expiring = ALL_CERTS.filter((c) => c.expiresInDays >= 0 && c.expiresInDays <= 30);
    const opId = `OP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return {
      toolCall: { tool: "ssh_renew_certificate", params: { certificateIds: expiring.map((c) => c.id) } },
      summary: `Bulk renewal triggered for ${expiring.length} expiring certificates.`,
      resultType: "action",
      actionDetail: [
        { label: "operationId", value: opId },
        { label: "status", value: "TRIGGERED" },
        { label: "certsAccepted", value: `${expiring.length}` },
        { label: "note", value: "Poll ssh_get_certificate_renewal_status with operationId" },
      ],
    };
  }

  // ── ssh_query_risky_keys ─────────────────────────────────────────────────
  if (q.includes("rogue")) {
    const keys = ALL_KEYS.filter((k) => k.riskStatus === "Rogue");
    return { toolCall: { tool: "ssh_query_risky_keys", params: { violationType: ["ROGUE"] } }, summary: `Found ${keys.length} rogue key${keys.length !== 1 ? "s" : ""}.`, resultType: "key-list", keys };
  }
  if (q.includes("orphan")) {
    const keys = ALL_KEYS.filter((k) => k.associatedUsers.length === 0 && k.riskStatus !== "None");
    return { toolCall: { tool: "ssh_query_risky_keys", params: { violationType: ["ORPHANED"] } }, summary: `Found ${keys.length} orphaned key${keys.length !== 1 ? "s" : ""} with no associated user.`, resultType: "key-list", keys };
  }
  if (q.includes("shared")) {
    const keys = ALL_KEYS.filter((k) => k.riskStatus === "Shared");
    return { toolCall: { tool: "ssh_query_risky_keys", params: { violationType: ["SHARED"] } }, summary: `Found ${keys.length} shared key${keys.length !== 1 ? "s" : ""}.`, resultType: "key-list", keys };
  }
  if (q.includes("stale") || q.includes("unused") || q.includes("dormant")) {
    const keys = ALL_KEYS.filter((k) => k.riskStatus === "Misplaced" || k.age === "—");
    return { toolCall: { tool: "ssh_query_risky_keys", params: { violationType: ["STALE"] } }, summary: `Found ${keys.length} stale/dormant key${keys.length !== 1 ? "s" : ""}.`, resultType: "key-list", keys };
  }
  if (q.includes("policy violation") || q.includes("non-compliant key") || q.includes("weak key")) {
    const keys = ALL_KEYS.filter((k) => k.complianceStatus === "Non-Compliant");
    return { toolCall: { tool: "ssh_query_risky_keys", params: { violationType: ["POLICY_VIOLATION"] } }, summary: `Found ${keys.length} key${keys.length !== 1 ? "s" : ""} with policy violations.`, resultType: "key-list", keys: keys.slice(0, 20) };
  }
  if ((q.includes("risky") && q.includes("key")) || (q.includes("risk") && q.includes("key")) || q.includes("all risk") || q.includes("key risk")) {
    const keys = ALL_KEYS.filter((k) => k.riskStatus !== "None");
    return { toolCall: { tool: "ssh_query_risky_keys", params: {} }, summary: `Found ${keys.length} key${keys.length !== 1 ? "s" : ""} with active risk violations.`, resultType: "key-list", keys: keys.slice(0, 20) };
  }

  // ── ssh_query_risky_certificates ─────────────────────────────────────────
  if (q.includes("expir") && (q.includes("cert") || q.includes("certs"))) {
    const expiring = ALL_CERTS.filter((c) => c.expiresInDays >= 0 && c.expiresInDays <= 30);
    const expired = ALL_CERTS.filter((c) => c.status === "Expired" || c.expiresInDays < 0);
    const all = [...new Set([...expiring, ...expired])];
    return { toolCall: { tool: "ssh_query_risky_certificates", params: { riskType: ["EXPIRING_SOON", "EXPIRED"], expiryWindowDays: 30 } }, summary: `Found ${expiring.length} expiring (≤30 days) and ${expired.length} already expired.`, resultType: "cert-list", certs: all };
  }
  if (q.includes("expired cert")) {
    const certs = ALL_CERTS.filter((c) => c.status === "Expired" || c.expiresInDays < 0);
    return { toolCall: { tool: "ssh_query_risky_certificates", params: { riskType: ["EXPIRED"] } }, summary: `Found ${certs.length} expired certificate${certs.length !== 1 ? "s" : ""}.`, resultType: "cert-list", certs };
  }
  if (q.includes("revok")) {
    const certs = ALL_CERTS.filter((c) => c.status === "Revoked");
    return { toolCall: { tool: "ssh_query_risky_certificates", params: { riskType: ["REVOKED"] } }, summary: certs.length > 0 ? `Found ${certs.length} revoked certificate${certs.length !== 1 ? "s" : ""}.` : "No revoked certificates found.", resultType: "cert-list", certs };
  }
  if ((q.includes("risky") && q.includes("cert")) || (q.includes("risk") && q.includes("cert")) || q.includes("all risky cert")) {
    const certs = ALL_CERTS.filter((c) => c.status === "Expired" || c.status === "Revoked" || c.expiresInDays <= 30);
    return { toolCall: { tool: "ssh_query_risky_certificates", params: {} }, summary: `Found ${certs.length} certificate${certs.length !== 1 ? "s" : ""} with active risk conditions.`, resultType: "cert-list", certs };
  }

  // ── ssh_query_certificate_inventory ──────────────────────────────────────
  if (q.includes("user cert")) {
    const certs = ALL_CERTS.filter((c) => c.type === "user");
    return { toolCall: { tool: "ssh_query_certificate_inventory", params: { type: "user" } }, summary: `Found ${certs.length} user certificate${certs.length !== 1 ? "s" : ""}.`, resultType: "cert-list", certs };
  }
  if (q.includes("host cert")) {
    const certs = ALL_CERTS.filter((c) => c.type === "host");
    return { toolCall: { tool: "ssh_query_certificate_inventory", params: { type: "host" } }, summary: `Found ${certs.length} host certificate${certs.length !== 1 ? "s" : ""}.`, resultType: "cert-list", certs };
  }
  if (q.includes("all cert") || q.includes("list cert") || q.includes("cert inventor") || q.includes("show cert") || (q.includes("cert") && (q.includes("list") || q.includes("all") || q.includes("show"))) {
    return { toolCall: { tool: "ssh_query_certificate_inventory", params: {} }, summary: `Found ${ALL_CERTS.length} certificates in inventory.`, resultType: "cert-list", certs: ALL_CERTS };
  }

  // ── ssh_query_key_inventory ──────────────────────────────────────────────
  const encMatch = q.match(/\b(rsa|ed25519|ecdsa)\b/);
  if (encMatch) {
    const enc = encMatch[1].toUpperCase() as SshKey["encryption"];
    const keys = ALL_KEYS.filter((k) => k.encryption === enc);
    return { toolCall: { tool: "ssh_query_key_inventory", params: { keyType: enc } }, summary: `Found ${keys.length} ${enc} key${keys.length !== 1 ? "s" : ""}.`, resultType: "key-list", keys: keys.slice(0, 20) };
  }
  const userMatch = q.match(/keys?\s+for\s+(?:user\s+)?(\S+)/);
  if (userMatch) {
    const user = userMatch[1];
    const keys = ALL_KEYS.filter((k) => k.associatedUsers.some((u) => u.toLowerCase().includes(user.toLowerCase())));
    return { toolCall: { tool: "ssh_query_key_inventory", params: { associatedUser: user } }, summary: `Found ${keys.length} key${keys.length !== 1 ? "s" : ""} for user "${user}".`, resultType: "key-list", keys };
  }
  if (q.includes("all key") || q.includes("list key") || q.includes("key inventor") || q.includes("show key") || q.includes("show all keys") || q === "keys") {
    return { toolCall: { tool: "ssh_query_key_inventory", params: { page: 1, pageSize: 20 } }, summary: `Returning first 20 of ${ALL_KEYS.length} keys in inventory (page 1 of ${Math.ceil(ALL_KEYS.length / 20)}).`, resultType: "key-list", keys: ALL_KEYS.slice(0, 20) };
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return {
    toolCall: { tool: "ssh_query_key_inventory", params: {} },
    summary: "",
    resultType: "error",
      error: `I couldn't match your query to an MCP tool. Try one of the suggested queries, or be more specific â for example: "show rogue keys", "rotate key [name]", "certs expiring soon."`,
  };
}

// ─── Styling helpers ──────────────────────────────────────────────────────────

function riskClass(r: SshKey["riskStatus"]) {
  if (r === "None") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (r === "Shared" || r === "Weak") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function complianceClass(c: SshKey["complianceStatus"]) {
  return c === "Compliant"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
}

function certStatusClass(s: SshCert["status"]) {
  if (s === "Active") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "Expired") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const c = TOOL_COLOR[toolCall.tool];
  return (
    <div className={cn("mt-2 mb-2 rounded-md border px-2.5 py-1.5", c.border, c.bg)}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <ChevronRight className="h-3 w-3" />
        Tool called
      </div>
      <div className={cn("font-mono text-[11px]", c.color)}>{toolCall.tool}</div>
      {Object.keys(toolCall.params).length > 0 && (
        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground space-y-0.5">
          {JSON.stringify(toolCall.params, null, 0)
            .replace(/^\{/, "")
            .replace(/\}$/, "")
            .split(",")
            .map((p, i) => (
              <div key={i}>{p.trim()}</div>
            ))}
        </div>
      )}
    </div>
  );
}

function KeyTable({ keys }: { keys: SshKey[] }) {
  if (keys.length === 0) return <div className="text-[12px] text-muted-foreground italic mt-2">No keys matched.</div>;
  return (
    <div className="mt-2 rounded-md border border-border/40 overflow-hidden">
      <table className="w-full text-[11.5px]">
        <thead className="bg-muted/40">
          <tr>
            {["Name", "Type", "Enc", "Length", "Age", "Associated Users", "Host Endpoints", "Has Cert", "Risk", "Compliance"].map((h) => (
              <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} className="border-t border-border/30 hover:bg-muted/20">
              <td className="px-2 py-1.5 font-mono text-foreground/90 truncate max-w-[180px]">{k.name}</td>
              <td className="px-2 py-1.5 text-muted-foreground capitalize">{k.type}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{k.encryption}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{k.length}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{k.age}</td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">{k.associatedUsers.join(", ") || "—"}</td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">{k.hostEndpoints.join(", ") || "—"}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{k.hasCert ? `Yes (${k.certCount})` : "No"}</td>
              <td className="px-2 py-1.5">
                <span className={cn("inline-flex px-1.5 py-0.5 rounded border text-[10px]", riskClass(k.riskStatus))}>
                  {k.riskStatus}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className={cn("inline-flex px-1.5 py-0.5 rounded border text-[10px]", complianceClass(k.complianceStatus))}>
                  {k.complianceStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CertTable({ certs }: { certs: SshCert[] }) {
  if (certs.length === 0) return <div className="text-[12px] text-muted-foreground italic mt-2">No certificates matched.</div>;
  return (
    <div className="mt-2 rounded-md border border-border/40 overflow-hidden">
      <table className="w-full text-[11.5px]">
        <thead className="bg-muted/40">
          <tr>
            {["Name", "Type", "CA", "Serial", "Principals", "Valid From", "Expires", "Endpoints", "Status", "Compliance"].map((h) => (
              <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {certs.map((c) => (
            <tr key={c.id} className="border-t border-border/30 hover:bg-muted/20">
              <td className="px-2 py-1.5 font-mono text-foreground/90 truncate max-w-[180px]">{c.certName}</td>
              <td className="px-2 py-1.5 text-muted-foreground capitalize">{c.type}</td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">{c.caName}</td>
              <td className="px-2 py-1.5 text-muted-foreground font-mono text-[10px]">{c.serialNumber}</td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">{c.principals.join(", ") || "—"}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{c.validFrom}</td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {c.expiresInDays < 0 ? `Expired ${Math.abs(c.expiresInDays)}d ago` : `${c.expiresInDays}d`}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">{c.endpoints.join(", ") || "—"}</td>
              <td className="px-2 py-1.5">
                <span className={cn("inline-flex px-1.5 py-0.5 rounded border text-[10px]", certStatusClass(c.status))}>
                  {c.status}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className={cn("inline-flex px-1.5 py-0.5 rounded border text-[10px]", complianceClass(c.complianceStatus))}>
                  {c.complianceStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionDetail({ detail }: { detail: { label: string; value: string }[] }) {
  return (
    <div className="mt-2 rounded-md border border-border/40 bg-muted/20 divide-y divide-border/30">
      {detail.map((row, i) => (
        <div key={i} className="flex items-start gap-3 px-2.5 py-1.5">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground min-w-[120px]">
            {row.label}
          </span>
          <span className="text-[11.5px] font-mono text-foreground/90 break-all">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function AgentBubble({ response }: { response: AgentResponse }) {
  const c = TOOL_COLOR[response.toolCall.tool];
  if (response.resultType === "error") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
        <div className="text-[12px] text-red-400 leading-relaxed">{response.error}</div>
      </div>
    );
  }
  return (
    <div className={cn("rounded-lg border-l-2 px-3 py-2.5", c.border, c.bg)}>
      <ToolCallBlock toolCall={response.toolCall} />
      <p className="text-[12.5px] text-foreground/90 leading-relaxed">{response.summary}</p>
      {response.resultType === "key-list" && response.keys && <KeyTable keys={response.keys} />}
      {response.resultType === "cert-list" && response.certs && <CertTable certs={response.certs} />}
      {response.resultType === "action" && response.actionDetail && <ActionDetail detail={response.actionDetail} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function McpAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "agent",
      text: "MCP Agent ready. I have access to 6 SSH lifecycle tools. Ask me anything about your SSH keys or certificates — or use the suggested queries below to get started.",
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: q,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const response = processQuery(q);

    const agentMsg: Message = {
      id: crypto.randomUUID(),
      role: "agent",
      text: "",
      response,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={["AVX Trust", "MCP Agent"]}
        title="MCP Agent"
        actions={
          <div className="text-[11px] text-muted-foreground">
            SSH Lifecycle Management · 6 tools available
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card/40 flex flex-col h-[calc(100vh-180px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2.5",
                msg.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              {msg.role === "agent" && (
                <div className="flex-shrink-0 h-7 w-7 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <Terminal className="h-3.5 w-3.5 text-primary" />
                </div>
              )}

              <div className={cn("max-w-[85%] min-w-0", msg.role === "user" ? "items-end" : "items-start")}>
                {msg.role === "user" ? (
                  <div className="rounded-lg bg-primary/15 border border-primary/30 px-3 py-2 text-[12.5px] text-foreground/95">
                    {msg.text}
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5">
                    {msg.response ? (
                      <AgentBubble response={msg.response} />
                    ) : (
                      <p className="text-[12.5px] text-foreground/90 leading-relaxed">{msg.text}</p>
                    )}
                  </div>
                )}
                <div className={cn("text-[10px] text-muted-foreground/60 mt-1", msg.role === "user" ? "text-right" : "text-left")}>
                  {msg.ts}
                </div>
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 h-7 w-7 rounded-md bg-muted border border-border flex items-center justify-center text-[11px] font-semibold text-foreground/70">
                  U
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggested queries */}
        <div className="px-4 py-2 border-t border-border/40 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/40">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 focus-within:border-primary/50 transition-colors">
            <ChevronRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder='Try "show rogue keys" or "certs expiring soon"...'
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                input.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
