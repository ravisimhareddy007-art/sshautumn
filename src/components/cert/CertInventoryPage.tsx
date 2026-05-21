import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiskTileBar, type RiskTileDef } from "@/components/common/RiskTileBar";
import { FilterChips } from "@/components/common/FilterChips";
import { CertDetailDrawer } from "@/components/cert/CertDetailDrawer";
import { RevokeCertDialog } from "@/components/cert/RevokeCertDialog";
import { RotateCertDialog } from "@/components/cert/RotateCertDialog";
import type { SshCert } from "@/data/mock";
import { ChevronDown, RefreshCw, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CertInventoryPage({
  scope,
  breadcrumbs,
  title,
  initialCerts,
}: {
  scope: "user" | "host";
  breadcrumbs: string[];
  title: string;
  initialCerts: SshCert[];
}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { status?: string; filter?: string };

  const [certs, setCerts] = useState<SshCert[]>(initialCerts);
  const [search_, setSearch] = useState("");
  const [tileFilter, setTileFilter] = useState<"expired" | "expiring30" | null>(
    search.status === "Expired" ? "expired" : search.filter === "expiring30" ? "expiring30" : null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerCert, setDrawerCert] = useState<SshCert | null>(null);
  const [revokeCert, setRevokeCert] = useState<SshCert | null>(null);
  const [rotateCert, setRotateCert] = useState<SshCert | null>(null);

  const expired = certs.filter((c) => c.status === "Expired").length;
  const expiring = certs.filter((c) => c.status === "Active" && c.expiresInDays > 0 && c.expiresInDays <= 30).length;

  const tiles: RiskTileDef[] = [
    { key: "expired", label: "Expired", count: expired, total: certs.length, color: "red" },
    { key: "expiring30", label: "Expiring in 30 Days", count: expiring, total: certs.length, color: "amber" },
  ];

  const filtered = useMemo(() => {
    let list = certs;
    if (tileFilter === "expired") list = list.filter((c) => c.status === "Expired");
    if (tileFilter === "expiring30") list = list.filter((c) => c.status === "Active" && c.expiresInDays > 0 && c.expiresInDays <= 30);
    if (search_) {
      const s = search_.toLowerCase();
      list = list.filter((c) => c.certKeyId.toLowerCase().includes(s) || c.certName.toLowerCase().includes(s));
    }
    return list;
  }, [certs, tileFilter, search_]);

  const selected = filtered.filter((c) => selectedIds.includes(c.id));

  const chips = [
    tileFilter === "expired" && { key: "expired", label: "Status: Expired" },
    tileFilter === "expiring30" && { key: "expiring30", label: "Expiring in 30 Days" },
  ].filter(Boolean) as { key: string; label: string }[];

  const updateCert = (id: string, patch: Partial<SshCert>) =>
    setCerts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div>
      <PageHeader breadcrumbs={breadcrumbs} title={title} />

      <RiskTileBar
        tiles={tiles}
        activeKey={tileFilter}
        onSelect={(k) => {
          setTileFilter((curr) => (curr === k ? null : (k as "expired" | "expiring30")));
          navigate({ to: ".", search: {} as never });
        }}
      />

      <FilterChips
        chips={chips}
        onRemove={() => {
          setTileFilter(null);
          navigate({ to: ".", search: {} as never });
        }}
      />

      <div className="flex items-center gap-2 bg-surface border border-border rounded-t-md px-3 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-[13px]"
            placeholder="Search certificates…"
            value={search_}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              toast.info("Certificate provisioning — navigate to a key and use Provision Key & Certificate.")
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={selected.length > 0 ? "default" : "outline"} disabled={selected.length === 0}>
                Actions <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDrawerCert(selected[0])}>View Details</DropdownMenuItem>
              <DropdownMenuItem
                disabled={selected[0]?.status !== "Active"}
                onClick={() => setRevokeCert(selected[0])}
              >
                Revoke
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selected[0]?.status !== "Active"}
                onClick={() => setRotateCert(selected[0])}
              >
                Rotate Certificate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Exported cert data to CSV.")}>Export</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Certificate file download started.")}>
                Download Certificate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Status updated.")}>Change Status</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="text-[12px] text-muted-foreground mx-2">
            1 to {filtered.length} of {filtered.length}
          </div>
          <Button size="sm" variant="ghost" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-t-0 border-border rounded-b-md overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-[11px] uppercase-tracking text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="text-left px-3 py-2">Cert Key ID / Name</th>
              <th className="text-left px-3 py-2">{scope === "user" ? "Associated Key" : "Associated Host Key"}</th>
              {scope === "host" && <th className="text-left px-3 py-2">Hostname / FQDN</th>}
              {scope === "user" && <th className="text-left px-3 py-2">Principal(s)</th>}
              <th className="text-left px-3 py-2">CA / Issuer</th>
              <th className="text-left px-3 py-2">Valid From</th>
              <th className="text-left px-3 py-2">Valid To</th>
              <th className="text-left px-3 py-2">Expires In</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Endpoint(s)</th>
              <th className="text-left px-3 py-2">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isSel = selectedIds.includes(c.id);
              const validToCls =
                c.expiresInDays <= 0
                  ? "text-risk-red bg-risk-red/10"
                  : c.expiresInDays <= 30
                    ? "text-risk-amber bg-risk-amber/10"
                    : "";
              return (
                <tr
                  key={c.id}
                  onClick={() => setDrawerCert(c)}
                  className={cn(
                    "border-t border-border hover:bg-muted/40 cursor-pointer",
                    isSel && "bg-row-selected",
                  )}
                >
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={(v) =>
                        setSelectedIds((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.certKeyId}</div>
                    <div className="text-[11px] text-muted-foreground">{c.certName}</div>
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={scope === "user" ? "/inventory/keys/user" : "/inventory/keys/host"}
                      search={{ highlight: c.associatedKeyId }}
                      className="text-primary hover:underline"
                    >
                      {c.associatedKeyName}
                    </Link>
                  </td>
                  {scope === "host" && <td className="px-3 py-2">{c.hostname}</td>}
                  {scope === "user" && (
                    <td className="px-3 py-2">
                      {c.principals[0] || "—"}
                      {c.principals.length > 1 && (
                        <Badge variant="outline" className="ml-1" title={c.principals.join(", ")}>
                          +{c.principals.length - 1}
                        </Badge>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">{c.caName}</td>
                  <td className="px-3 py-2">{c.validFrom}</td>
                  <td className={cn("px-3 py-2 rounded", validToCls)}>{c.validTo}</td>
                  <td className={cn("px-3 py-2", validToCls)}>{c.expiresIn}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        c.status === "Active" && "bg-risk-green/15 text-risk-green border-risk-green/30",
                        c.status === "Expired" && "bg-risk-red/15 text-risk-red border-risk-red/30",
                        c.status === "Revoked" && "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" title={c.endpoints.join(", ")}>
                      {c.endpoints.length}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        c.complianceStatus === "Compliant"
                          ? "bg-risk-green/15 text-risk-green border-risk-green/30"
                          : "bg-risk-red/15 text-risk-red border-risk-red/30",
                      )}
                    >
                      {c.complianceStatus}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                  No certificates match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CertDetailDrawer
        cert={drawerCert}
        onClose={() => setDrawerCert(null)}
        onRevoke={(c) => {
          setDrawerCert(null);
          setRevokeCert(c);
        }}
        onRotate={(c) => {
          setDrawerCert(null);
          setRotateCert(c);
        }}
      />

      <RevokeCertDialog
        cert={revokeCert}
        onClose={() => setRevokeCert(null)}
        onRevoked={(c) => updateCert(c.id, { status: "Revoked" })}
      />

      <RotateCertDialog
        cert={rotateCert}
        onClose={() => setRotateCert(null)}
        onRotated={(c) =>
          updateCert(c.id, {
            validTo: "2026-08-20",
            expiresIn: "90 days",
            expiresInDays: 90,
          })
        }
      />
    </div>
  );
}
