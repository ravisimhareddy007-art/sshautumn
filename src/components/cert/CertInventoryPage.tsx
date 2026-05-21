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
import { AssociatedKeyLink } from "@/components/cert/AssociatedKeyLink";
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
          <Button size="sm" variant="ghost" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="inv-frame">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="sl" style={{ left: 0, width: 36, minWidth: 36 }}></th>
                <th className="sl" style={{ left: 36, minWidth: 240, maxWidth: 240 }}>Cert Key ID / Name</th>
                <th>{scope === "user" ? "Associated Key" : "Associated Host Key"}</th>
                {scope === "host" && <th>Hostname / FQDN</th>}
                {scope === "user" && <th>Principal(s)</th>}
                <th>CA / Issuer</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th>Expires In</th>
                <th>Status</th>
                <th>Endpoint(s)</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isSel = selectedIds.includes(c.id);
                const validToCls =
                  c.expiresInDays <= 0
                    ? "text-risk-red"
                    : c.expiresInDays <= 30
                      ? "text-risk-amber"
                      : "";
                return (
                  <tr
                    key={c.id}
                    onClick={() => setDrawerCert(c)}
                    className={cn("cursor-pointer", isSel && "row-selected")}
                  >
                    <td className="sl" style={{ left: 0, width: 36, minWidth: 36 }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={(v) =>
                          setSelectedIds((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))
                        }
                      />
                    </td>
                    <td className="sl" style={{ left: 36, minWidth: 240, maxWidth: 240 }} title={`${c.certKeyId} · ${c.certName}`}>
                      <span className="truncate-inner">
                        <span className="font-medium">{c.certKeyId}</span>
                        <span className="text-[11px] text-muted-foreground ml-1">{c.certName}</span>
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} title={c.associatedKeyName}>
                      <Link
                        to={scope === "user" ? "/inventory/keys/user" : "/inventory/keys/host"}
                        search={{ highlight: c.associatedKeyId }}
                        className="text-primary hover:underline"
                      >
                        {c.associatedKeyName}
                      </Link>
                    </td>
                    {scope === "host" && <td title={c.hostname}>{c.hostname}</td>}
                    {scope === "user" && (
                      <td title={c.principals.join(", ")}>
                        {c.principals[0] || "—"}
                        {c.principals.length > 1 && (
                          <Badge variant="outline" className="ml-1">+{c.principals.length - 1}</Badge>
                        )}
                      </td>
                    )}
                    <td title={c.caName}>{c.caName}</td>
                    <td>{c.validFrom}</td>
                    <td className={validToCls}>{c.validTo}</td>
                    <td className={validToCls}>{c.expiresIn}</td>
                    <td>
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
                    <td>
                      <Badge variant="outline" title={c.endpoints.join(", ")}>
                        {c.endpoints.length}
                      </Badge>
                    </td>
                    <td>
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
                  <td colSpan={scope === "host" ? 11 : 11} style={{ height: "auto", whiteSpace: "normal", textAlign: "center", padding: "48px", color: "var(--color-muted-foreground)", maxWidth: "none" }}>
                    No certificates match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="inv-pagination">
          <span>
            {filtered.length === 0 ? 0 : 1} to {filtered.length} of {filtered.length}
          </span>
        </div>
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
