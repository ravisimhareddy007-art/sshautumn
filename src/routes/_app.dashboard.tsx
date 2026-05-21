import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { USER_KEYS, HOST_KEYS, USER_CERTS, HOST_CERTS, GROUPS } from "@/data/mock";
import {
  KeyRound, Server, Users, ChevronRight, KeyRound as KeyIcon,
  Globe, Plus, FileText, RefreshCw, ClipboardList,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Legend, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [group, setGroup] = useState("All Groups");

  return (
    <div>
      <PageHeader
        breadcrumbs={["DASHBOARD"]}
        title="SSH Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Groups</span>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="h-8 w-[180px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <KeySnapshot />
          <CertificateStatus />
          <CertComplianceTrend />
        </div>
        <div className="lg:col-span-1">
          <ActivityCenter />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION 1 — KEY SNAPSHOT
========================================================= */
function KeySnapshot() {
  const [scope, setScope] = useState<"user" | "host">("user");
  return (
    <Panel>
      <SectionHeader
        title="Key Snapshot"
        right={
          <div className="flex items-center gap-3">
            <PillToggle
              options={[
                { value: "user", label: "User Keys" },
                { value: "host", label: "Host Keys" },
              ]}
              value={scope}
              onChange={(v) => setScope(v as "user" | "host")}
            />
            <Timestamp text="0m ago" />
          </div>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Keys"
          value={USER_KEYS.length + HOST_KEYS.length}
          icon={<KeyRound className="h-4 w-4 text-primary" />}
          to="/inventory/keys/user"
        />
        <StatCard
          label="User Keys"
          value={USER_KEYS.length}
          icon={<Users className="h-4 w-4 text-primary" />}
          to="/inventory/keys/user"
        />
        <StatCard
          label="Host Keys"
          value={HOST_KEYS.length}
          icon={<Server className="h-4 w-4 text-primary" />}
          to="/inventory/keys/host"
        />
        <StatCard
          label="Hosts"
          value={2}
          icon={<Server className="h-4 w-4 text-primary" />}
          to="/inventory/hosts"
        />
      </div>
    </Panel>
  );
}

function StatCard({
  label, value, icon, to,
}: { label: string; value: number; icon: React.ReactNode; to: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 border-l-4 border-l-primary hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase-tracking text-muted-foreground">{label}</div>
            <div className="text-[28px] font-bold leading-tight mt-1">{value}</div>
          </div>
          <div className="p-2 rounded-md bg-primary/10">{icon}</div>
        </div>
      </Card>
    </Link>
  );
}

/* =========================================================
   SECTION 2 — CERTIFICATE STATUS
========================================================= */
function CertificateStatus() {
  return (
    <Panel>
      <SectionHeader
        title="Certificate Status"
        badge="NEW · AUTUMN RELEASE"
        right={<Timestamp text="0m ago" />}
      />
      <CertExpiryTimeline />
    </Panel>
  );
}

/* ---------- Cert Expiry Timeline (BarChart) ---------- */
type TimelineRange = "7d" | "30d" | "90d";
const TIMELINE_DATA: Record<TimelineRange, { date: string; user: number; host: number; today?: boolean }[]> = {
  "7d": [
    { date: "May 21", user: 1, host: 0, today: true },
    { date: "May 22", user: 0, host: 0 },
    { date: "May 23", user: 0, host: 0 },
    { date: "May 24", user: 1, host: 0 },
    { date: "May 25", user: 1, host: 0 },
    { date: "May 26", user: 0, host: 0 },
    { date: "May 27", user: 0, host: 0 },
  ],
  "30d": [
    { date: "May 21", user: 2, host: 0, today: true },
    { date: "May 28", user: 0, host: 0 },
    { date: "Jun 04", user: 1, host: 1 },
    { date: "Jun 11", user: 0, host: 0 },
  ],
  "90d": [
    { date: "May 2026", user: 2, host: 1, today: true },
    { date: "Jun 2026", user: 1, host: 0 },
    { date: "Jul 2026", user: 0, host: 1 },
    { date: "Aug 2026", user: 1, host: 0 },
  ],
};

function CertExpiryTimeline() {
  const [range, setRange] = useState<TimelineRange>("7d");
  const navigate = useNavigate();
  const data = TIMELINE_DATA[range];
  const todayLabel = data.find((d) => d.today)?.date;

  return (
    <div className="rounded-lg border border-border bg-white p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[14px] font-semibold text-foreground">Cert Expiry Timeline</div>
        <PillToggle
          options={[
            { value: "7d", label: "7 Days" },
            { value: "30d", label: "30 Days" },
            { value: "90d", label: "90 Days" },
          ]}
          value={range}
          onChange={(v) => setRange(v as TimelineRange)}
        />
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
            onClick={() => navigate({ to: "/inventory/certificates/user", search: { filter: "expiring30" } as never })}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "rgba(107, 95, 214, 0.06)" }}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E2E8F0" }}
              formatter={(v: number, n: string) => [v, n === "user" ? "User Certs" : "Host Certs"]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              formatter={(v) => v === "user" ? "User Certs" : "Host Certs"}
            />
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: "Today", position: "top", fill: "#EF4444", fontSize: 10 }}
              />
            )}
            <Bar dataKey="user" fill="#6B5FD6" radius={[3, 3, 0, 0]} cursor="pointer" />
            <Bar dataKey="host" fill="#F59E0B" radius={[3, 3, 0, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION 3 — CERT COMPLIANCE TREND
========================================================= */
function CertComplianceTrend() {
  const [scope, setScope] = useState<"user" | "host">("user");
  const [range, setRange] = useState<"1W" | "1M" | "3M" | "1Y">("1W");
  const dates = ["May 12","May 13","May 14","May 15","May 16","May 17","May 18","May 19","May 20","May 21","May 22"];
  const data = dates.map((d) => ({ date: d, compliant: 8, nonCompliant: 3 }));

  return (
    <Panel>
      <SectionHeader
        title="Cert Compliance Trend"
        right={
          <div className="flex items-center gap-3">
            <PillToggle
              options={[
                { value: "user", label: "User Certs" },
                { value: "host", label: "Host Certs" },
              ]}
              value={scope}
              onChange={(v) => setScope(v as "user" | "host")}
            />
            <PillToggle
              options={[
                { value: "1W", label: "1W" },
                { value: "1M", label: "1M" },
                { value: "3M", label: "3M" },
                { value: "1Y", label: "1Y" },
              ]}
              value={range}
              onChange={(v) => setRange(v as "1W" | "1M" | "3M" | "1Y")}
            />
            <Timestamp text="20m ago" />
          </div>
        }
      />
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 15]} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E2E8F0" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
            <Line type="monotone" dataKey="compliant" name="Compliant Certs" stroke="#22C55E" strokeWidth={2} dot={{ r: 3, fill: "#22C55E" }} />
            <Line type="monotone" dataKey="nonCompliant" name="Non-Compliant Certs" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: "#EF4444" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/* =========================================================
   RIGHT PANEL — ACTIVITY CENTER
========================================================= */
function ActivityCenter() {
  return (
    <div className="space-y-4 sticky top-4">
      <Panel>
        <div className="text-[14px] font-semibold text-foreground mb-3">Activity Center</div>
        <div className="space-y-2">
          <ActionButton icon={<KeyIcon className="h-4 w-4" />} label="Onboard Host" />
          <ActionButton icon={<Globe className="h-4 w-4" />} label="Network Scan" />
          <ActionButton icon={<Plus className="h-4 w-4" />} label="Create and Provision Key" />
        </div>

        <div className="flex items-center gap-2 mt-5 mb-3">
          <div className="text-[14px] font-semibold text-foreground">Cert Actions</div>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase-tracking">NEW</span>
        </div>
        <div className="space-y-2">
          <ActionButton icon={<FileText className="h-4 w-4" />} label="Provision Certificate" tone="indigo" />
          <ActionButton icon={<RefreshCw className="h-4 w-4" />} label="Rotate Expiring Certs" tone="indigo" />
          <ActionButton icon={<ClipboardList className="h-4 w-4" />} label="View Compliance Report" tone="indigo" />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14px] font-semibold text-foreground">Key Adoption</div>
          <Timestamp text="2h ago" />
        </div>
        <div className="space-y-2">
          <AdoptionRow label="Keys Created" value={2} />
          <AdoptionRow label="Keys Rotated" value={0} />
          <AdoptionRow label="Keys Deleted" value={1} />
          <AdoptionRow label="Keys Provisioned" value={0} />
        </div>

        <div className="flex items-center gap-2 mt-5 mb-3">
          <div className="text-[14px] font-semibold text-foreground">Cert Adoption</div>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase-tracking">NEW</span>
        </div>
        <div className="space-y-2">
          <AdoptionRow label="Certs Provisioned" value={6} />
          <AdoptionRow label="Certs Rotated" value={1} />
          <AdoptionRow label="Certs Revoked" value={1} />
          <AdoptionRow label="Certs Expired" value={3} />
        </div>
      </Panel>
    </div>
  );
}

function ActionButton({
  icon, label, tone = "primary",
}: { icon: React.ReactNode; label: string; tone?: "primary" | "indigo" }) {
  const cls = tone === "indigo"
    ? "bg-[#4F46E5] hover:bg-[#4338CA]"
    : "bg-primary hover:bg-primary-hover";
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-white text-[13px] font-medium cursor-pointer transition-colors",
        cls,
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 opacity-80" />
    </button>
  );
}

function AdoptionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-l-2 border-l-primary bg-muted/50 rounded-r px-3 py-2">
      <span className="text-[12px] text-foreground">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/* =========================================================
   SHARED PRIMITIVES
========================================================= */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      {children}
    </div>
  );
}

function SectionHeader({
  title, badge, right,
}: { title: string; badge?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground">{title}</div>
        {badge && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase-tracking">
            {badge}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

function PillToggle<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-colors",
            value === o.value
              ? "bg-foreground text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Timestamp({ text }: { text: string }) {
  return <span className="text-[11px] text-text-muted">{text}</span>;
}
