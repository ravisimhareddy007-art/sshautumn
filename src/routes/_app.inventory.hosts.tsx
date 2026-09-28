import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterChips } from "@/components/common/FilterChips";
import {
  HOSTS,
  HYBRID_USE_LABELS,
  hostReadiness,
  type Host,
  type HybridReadiness,
} from "@/data/mock";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";

type Search = { readiness?: HybridReadiness };

export const Route = createFileRoute("/_app/inventory/hosts")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const r = s.readiness;
    return r === "Ready" || r === "Partially Ready" || r === "Not Ready" || r === "Unknown" ? { readiness: r } : {};
  },
  component: Page,
});

const READINESS_STYLE: Record<HybridReadiness, string> = {
  Ready: "bg-risk-green/15 text-risk-green border-risk-green/30",
  "Partially Ready": "bg-risk-amber/15 text-risk-amber border-risk-amber/30",
  "Not Ready": "bg-muted text-muted-foreground border-border",
  Unknown: "bg-muted text-muted-foreground border-border",
};

function ReadinessBadge({ host }: { host: Host }) {
  const r = hostReadiness(host);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge variant="outline" className={READINESS_STYLE[r]}>{r}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-3">
        <div className="text-[12px] font-semibold mb-2">MLDSA44-ED25519 support on {host.deviceName}</div>
        {host.hybridUses ? (
          <ul className="space-y-1.5">
            {HYBRID_USE_LABELS.map((u) => (
              <li key={u.key} className="flex items-center gap-2 text-[12px]">
                {host.hybridUses![u.key] ? (
                  <Check className="h-3.5 w-3.5 text-risk-green" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className={host.hybridUses![u.key] ? "" : "text-muted-foreground"}>{u.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[12px] text-muted-foreground">The host configuration could not be read during discovery.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Page() {
  const search = Route.useSearch();
  const [hosts] = useState<Host[]>(HOSTS);
  const [readiness, setReadiness] = useState<HybridReadiness | "All">(search.readiness ?? "All");
  const [version, setVersion] = useState<string>("All");

  const versions = useMemo(
    () => Array.from(new Set(hosts.map((h) => h.openSshVersion).filter(Boolean) as string[])).sort().reverse(),
    [hosts],
  );

  const filtered = useMemo(
    () =>
      hosts.filter((h) => {
        if (readiness !== "All" && hostReadiness(h) !== readiness) return false;
        if (version === "Unknown" && h.openSshVersion) return false;
        if (version !== "All" && version !== "Unknown" && h.openSshVersion !== version) return false;
        return true;
      }),
    [hosts, readiness, version],
  );

  const chips = [
    readiness !== "All" ? { key: "readiness", label: `Hybrid Key Readiness: ${readiness}` } : null,
    version !== "All" ? { key: "version", label: `OpenSSH Version: ${version}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div>
      <PageHeader
        breadcrumbs={["INVENTORY", "Host Inventory"]}
        title="Host Inventory"
        actions={
          <>
            <Button size="sm" onClick={() => toast.info("Add Host — Coming Soon")}>+ Add Host</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success("Exported to CSV.")}>Export</Button>
          </>
        }
      />

      <FilterChips
        chips={chips}
        onRemove={(k) => {
          if (k === "readiness") setReadiness("All");
          if (k === "version") setVersion("All");
        }}
      />

      <div className="flex items-center gap-2 bg-surface border border-border border-b-0 rounded-t-md px-3 py-2">
        <span className="text-[12px] text-muted-foreground">OpenSSH Version</span>
        <Select value={version} onValueChange={setVersion}>
          <SelectTrigger className="h-8 w-[150px] text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All versions</SelectItem>
            {versions.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
            <SelectItem value="Unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground ml-2">Hybrid Key Readiness</span>
        <Select value={readiness} onValueChange={(v) => setReadiness(v as HybridReadiness | "All")}>
          <SelectTrigger className="h-8 w-[170px] text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Ready">Ready</SelectItem>
            <SelectItem value="Partially Ready">Partially Ready</SelectItem>
            <SelectItem value="Not Ready">Not Ready</SelectItem>
            <SelectItem value="Unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="inv-frame inv-frame--standalone">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="sl" style={{ left: 0, minWidth: 200, maxWidth: 200 }}>Device Name</th>
                <th>FQDN / IP</th>
                <th>Host Name</th>
                <th>Group</th>
                <th>Host Status</th>
                <th>OpenSSH Version</th>
                <th>Hybrid Key Readiness</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id}>
                  <td className="sl font-mono" style={{ left: 0, minWidth: 200, maxWidth: 200 }} title={h.deviceName}>{h.deviceName}</td>
                  <td className="font-mono" title={h.fqdn}>{h.fqdn}</td>
                  <td title={h.hostName}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-risk-green inline-block" />
                      {h.hostName}
                    </span>
                  </td>
                  <td>{h.group}</td>
                  <td>
                    <Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">
                      {h.hostStatus}
                    </Badge>
                  </td>
                  <td>{h.openSshVersion ?? "Unknown"}</td>
                  <td><ReadinessBadge host={h} /></td>
                  <td>
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toast.success(`Fetching keys from ${h.deviceName}…`)}>
                        Fetch Keys
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info(`User: ${h.username} · Port: ${h.port}`)}>
                        Credentials
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--color-muted-foreground)" }}>
                    No hosts match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="inv-pagination">
          <span>1 to {filtered.length} of {filtered.length}</span>
        </div>
      </div>
    </div>
  );
}

