import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { USER_KEYS, HOST_KEYS, USER_CERTS, HOST_CERTS, GROUPS } from "@/data/mock";
import { ShieldAlert, Clock, KeyRound, Server, Users, FileBadge } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [group, setGroup] = useState("All Groups");

  const expiredUser = USER_CERTS.filter((c) => c.status === "Expired").length;
  const expiredHost = HOST_CERTS.filter((c) => c.status === "Expired").length;
  const expiringUser = USER_CERTS.filter(
    (c) => c.status === "Active" && c.expiresInDays > 0 && c.expiresInDays <= 30,
  ).length;
  const expiringHost = HOST_CERTS.filter(
    (c) => c.status === "Active" && c.expiresInDays > 0 && c.expiresInDays <= 30,
  ).length;

  const totalExpired = expiredUser + expiredHost;
  const totalExpiring = expiringUser + expiringHost;

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

      <section className="mb-6">
        <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-2">
          Key Snapshot
        </div>
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
      </section>

      <section>
        <div className="flex items-baseline gap-2 mb-2">
          <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground">
            Certificate Status
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase-tracking">
            New · Autumn
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CertTile
            label="Expired Certs"
            count={totalExpired}
            subUser={expiredUser}
            subHost={expiredHost}
            color="red"
            icon={<ShieldAlert />}
            to="/inventory/certificates/user"
            search={{ status: "Expired" }}
          />
          <CertTile
            label="Expiring in 30 Days"
            count={totalExpiring}
            subUser={expiringUser}
            subHost={expiringHost}
            color="amber"
            icon={<Clock />}
            to="/inventory/certificates/user"
            search={{ filter: "expiring30" }}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 border-l-4 border-l-primary hover:shadow-md transition-shadow">
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

function CertTile({
  label,
  count,
  subUser,
  subHost,
  color,
  icon,
  to,
  search,
}: {
  label: string;
  count: number;
  subUser: number;
  subHost: number;
  color: "red" | "amber";
  icon: React.ReactNode;
  to: string;
  search?: Record<string, string>;
}) {
  const isZero = count === 0;
  const effective = isZero ? "green" : color;
  const borderCls = {
    red: "border-l-risk-red",
    amber: "border-l-risk-amber",
    green: "border-l-risk-green",
  }[effective];
  const textCls = {
    red: "text-risk-red",
    amber: "text-risk-amber",
    green: "text-risk-green",
  }[effective];
  return (
    <Link to={to} search={search as never}>
      <Card className={cn("p-5 border-l-4 hover:shadow-md transition-shadow", borderCls)}>
        <div className="flex items-start gap-4">
          <div className={cn("p-2 rounded-md bg-muted", textCls)}>
            <FileBadge className="h-5 w-5" />
            <span className="sr-only">{icon}</span>
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase-tracking text-muted-foreground">{label}</div>
            <div className={cn("text-[32px] font-bold leading-tight", textCls)}>{count}</div>
            <div className="text-[12px] text-muted-foreground mt-1">
              User: {subUser} <span className="mx-1">·</span> Host: {subHost}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">Updated just now</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
