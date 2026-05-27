import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiskTileBar, type RiskTileDef } from "@/components/common/RiskTileBar";
import { ColumnPicker, type ColumnDef } from "@/components/common/ColumnPicker";
import { FilterChips } from "@/components/common/FilterChips";
import { ProvisionDialog } from "@/components/key/ProvisionDialog";
import { RotateKeyDialog } from "@/components/key/RotateKeyDialog";
import { DeleteKeyWithCertDialog } from "@/components/key/DeleteKeyWithCertDialog";
import { CertificatesOfKeyModal } from "@/components/key/CertificatesOfKeyModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CertDetailDrawer } from "@/components/cert/CertDetailDrawer";
import { usePersistedState } from "@/hooks/use-persisted-state";
import type { SshKey, SshCert, RiskStatus } from "@/data/mock";
import { riskColor, GROUPS } from "@/data/mock";
import { ChevronDown, ChevronRight, Columns, Link2, Plus, RefreshCw, Search, Shield, ClipboardList, SlidersHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  rotateKeyAction, coupledRotateAction, provisionCertAction,
  certRevokeAction, COMBO_LABEL, COMBO_BADGE_CLASS,
} from "@/lib/clm-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface KeyInventoryProps {
  scope: "user" | "host";
  breadcrumbs: string[];
  title: string;
  riskKinds: RiskStatus[];
  initialKeys: SshKey[];
  total: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Key Name", mandatory: true },
  { key: "associatedUsers", label: "Associated Users" },
  { key: "clientEndpoints", label: "Client Endpoint(s)" },
  { key: "hostEndpoints", label: "Host Endpoint(s)" },
  { key: "age", label: "Age" },
  { key: "encryption", label: "Encryption" },
  { key: "length", label: "Length" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "comment", label: "Comment" },
  { key: "keyComplianceGroup", label: "Key Compliance Group" },
  { key: "status", label: "Status" },
  { key: "filePaths", label: "FilePaths" },
  { key: "riskStatus", label: "Risk Status" },
  { key: "complianceStatus", label: "Compliance Status" },
];

const DEFAULT_USER_COLS = ["name", "associatedUsers", "clientEndpoints", "hostEndpoints", "age"];
const DEFAULT_HOST_COLS = ["name", "clientEndpoints", "hostEndpoints", "age", "encryption", "length"];

const PAGE = 25;

export function KeyInventoryPage(props: KeyInventoryProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { highlight?: string };

  const [keys, setKeys] = useState<SshKey[]>(props.initialKeys);
  const [group, setGroup] = useState("All Keys");
  const [search_, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskStatus | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cols, setCols] = usePersistedState<string[]>(
    `kcols-${props.scope}`,
    props.scope === "user" ? DEFAULT_USER_COLS : DEFAULT_HOST_COLS,
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [certsForKey, setCertsForKey] = useState<SshKey | null>(null);
  const [provisionFor, setProvisionFor] = useState<SshKey | null>(null);
  const [rotateFor, setRotateFor] = useState<SshKey | null>(null);
  const [deleteWithCertFor, setDeleteWithCertFor] = useState<SshKey | null>(null);
  const [confirmDeleteOnly, setConfirmDeleteOnly] = useState<SshKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<SshKey | null>(null);
  const [statusChangeFor, setStatusChangeFor] = useState<SshKey | null>(null);
  const [statusNew, setStatusNew] = useState<"Active" | "Inactive">("Active");
  const [drawerCert, setDrawerCert] = useState<SshCert | null>(null);

  const filtered = useMemo(() => {
    let list = keys;
    if (group !== "All Keys") list = list.filter((k) => k.keyComplianceGroup === group);
    if (riskFilter) list = list.filter((k) => k.riskStatus === riskFilter);
    if (search_) {
      const s = search_.toLowerCase();
      list = list.filter(
        (k) =>
          k.name.toLowerCase().includes(s) ||
          k.fingerprint.toLowerCase().includes(s) ||
          k.associatedUsers.some((u) => u.toLowerCase().includes(s)),
      );
    }
    return list;
  }, [keys, group, riskFilter, search_]);

  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const selectedKeys = paged.filter((k) => selectedIds.includes(k.id));

  const tiles: RiskTileDef[] = useMemo(() => {
    const counts: Record<string, number> = {};
    props.riskKinds.forEach((r) => {
      counts[r] = keys.filter((k) => k.riskStatus === r).length;
    });
    return props.riskKinds.map((r) => ({
      key: r,
      label: `${r} Keys`,
      count: counts[r] ?? 0,
      total: keys.length,
      color: ["Rogue", "Suspicious", "Misplaced"].includes(r) ? "red" : "amber",
      info: `Keys flagged as ${r}`,
    }));
  }, [keys, props.riskKinds]);

  const visibleCols = ALL_COLUMNS.filter((c) => cols.includes(c.key) || c.mandatory);

  const toggleSelectAll = () => {
    if (selectedIds.length === paged.length && paged.length > 0) setSelectedIds([]);
    else setSelectedIds(paged.map((k) => k.id));
  };

  const updateKey = (id: string, patch: Partial<SshKey>) =>
    setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const removeKey = (id: string) => {
    setKeys((ks) => ks.filter((k) => k.id !== id));
    setSelectedIds((s) => s.filter((x) => x !== id));
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const chips = [
    riskFilter ? { key: "risk", label: `Risk: ${riskFilter}` } : null,
    search.highlight ? { key: "highlight", label: `Highlight: ${search.highlight}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div>
      <PageHeader breadcrumbs={props.breadcrumbs} title={props.title} />

      <RiskTileBar
        tiles={tiles}
        activeKey={riskFilter}
        onSelect={(k) => {
          setRiskFilter((curr) => (curr === k ? null : (k as RiskStatus)));
          setPage(1);
        }}
      />

      <FilterChips
        chips={chips}
        onRemove={(k) => {
          if (k === "risk") setRiskFilter(null);
          if (k === "highlight") navigate({ to: ".", search: {} as never });
        }}
      />

      <div className="flex items-center gap-2 bg-surface border border-border rounded-t-md px-3 py-2">
        <span className="text-[12px] text-muted-foreground">Groups</span>
        <Select value={group} onValueChange={(v) => { setGroup(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-[160px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Keys">All Keys</SelectItem>
            {GROUPS.filter((g) => g !== "All Groups").map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-md ml-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 pr-8 h-8 text-[13px]"
            placeholder="Type your search and press Enter…"
            value={search_}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <button
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
            title="Advanced search"
            onClick={() => toast.info("Advanced search panel -- coming soon.")}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => toast.info("Add Key -- Coming Soon")}>
            <Plus className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={selectedKeys.length > 0 ? "default" : "outline"}
                disabled={selectedKeys.length === 0}
              >
                Actions <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">

              {/* Combination label */}
              {selectedKeys[0] && (
                <div className="px-2 py-1.5 mb-1 border-b border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Combination</span>
                  <div className={cn("mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded border inline-block", COMBO_BADGE_CLASS[selectedKeys[0].combination])}>
                    {COMBO_LABEL[selectedKeys[0].combination]}
                  </div>
                </div>
              )}

              {/* Always available */}
              <DropdownMenuItem onClick={() => toast.success("Key updated.")}>Modify</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatusChangeFor(selectedKeys[0]); setStatusNew(selectedKeys[0].status === "Active" ? "Inactive" : "Active"); }}>
                Change Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`Exported ${selectedKeys.length} key(s) to CSV.`)}>Export</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Key file download started.")}>Download</DropdownMenuItem>

              {/* Provision Certificate -- combo-aware */}
              {(() => {
                const a = selectedKeys[0] ? provisionCertAction(selectedKeys[0].combination) : { show: false, enabled: false };
                if (!a.show) return null;
                if (!a.enabled)
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem disabled><span className="pointer-events-auto">Provision Certificate</span></DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">{a.tooltip}</TooltipContent>
                    </Tooltip>
                  );
                return <DropdownMenuItem onClick={() => setProvisionFor(selectedKeys[0])}>Provision Certificate</DropdownMenuItem>;
              })()}

              {/* Rotate Key -- combo-aware */}
              {(() => {
                const a = selectedKeys[0] ? rotateKeyAction(selectedKeys[0].combination) : { show: false, enabled: false };
                if (!a.show) return null;
                if (!a.enabled)
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem disabled><span className="pointer-events-auto">Rotate Key</span></DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">{a.tooltip}</TooltipContent>
                    </Tooltip>
                  );
                return <DropdownMenuItem onClick={() => setRotateFor(selectedKeys[0])}>Rotate Key</DropdownMenuItem>;
              })()}

              {/* Coupled Rotate -- private_cert only */}
              {(() => {
                const a = selectedKeys[0] ? coupledRotateAction(selectedKeys[0].combination) : { show: false, enabled: false };
                if (!a.show) return null;
                return (
                  <DropdownMenuItem onClick={() => setRotateFor(selectedKeys[0])}>
                    Coupled Rotate (Key + Cert)
                  </DropdownMenuItem>
                );
              })()}

              {/* Revoke Cert -- only when cert exists on relevant combo */}
              {(() => {
                const combo = selectedKeys[0]?.combination;
                const hasCert = selectedKeys[0]?.hasCert;
                if (!hasCert || (combo !== "private_cert" && combo !== "public_cert")) return null;
                const a = selectedKeys[0] ? certRevokeAction(selectedKeys[0].status === "Revoked" ? "Revoked" : "Active") : { show: false, enabled: false };
                if (!a.enabled)
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem disabled><span className="pointer-events-auto">Revoke Certificate</span></DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">{a.tooltip}</TooltipContent>
                    </Tooltip>
                  );
                return (
                  <DropdownMenuItem onClick={() => setConfirmRevoke(selectedKeys[0])}>
                    Revoke Certificate
                  </DropdownMenuItem>
                );
              })()}

              <DropdownMenuItem disabled>Rollback</DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Delete</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setConfirmDeleteOnly(selectedKeys[0])}>Delete Key Only</DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!selectedKeys[0]?.hasCert}
                      onClick={() => setDeleteWithCertFor(selectedKeys[0])}
                    >
                      Delete Key + Certificate
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuItem onClick={() => toast.success("Tags uploaded successfully.")}>Upload Bulk Tags</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Key group updated.")}>Change Key Group</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="ghost" onClick={() => setColPickerOpen(true)} title="Columns">
            <Columns className="h-4 w-4" />
          </Button>

          <Button size="sm" variant="ghost" onClick={refresh} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="inv-frame">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="sl" style={{ left: 0, width: 36, minWidth: 36 }}></th>
                <th className="sl" style={{ left: 36, width: 36, minWidth: 36 }}>
                  <Checkbox
                    checked={paged.length > 0 && selectedIds.length === paged.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                {visibleCols.map((c, i) => {
                  const sticky = i === 0;
                  return (
                    <th
                      key={c.key}
                      className={cn(sticky && "sl")}
                      style={sticky ? { left: 72, minWidth: 240, maxWidth: 240 } : undefined}
                    >
                      {c.label}
                      {c.mandatory && <span className="text-risk-red ml-0.5">*</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.map((k) => {
                const isExpanded = !!expanded[k.id];
                const isSelected = selectedIds.includes(k.id);
                const isHighlighted = search.highlight === k.id;
                return (
                  <Row key={k.id}>
                    <tr className={cn(isSelected && "row-selected", isHighlighted && "row-highlight")}>
                      <td className="sl" style={{ left: 0, width: 36, minWidth: 36 }}>
                        <button
                          className="p-0.5 hover:bg-muted rounded inline-flex"
                          onClick={() => setExpanded((e) => ({ ...e, [k.id]: !e[k.id] }))}
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="sl" style={{ left: 36, width: 36, minWidth: 36 }}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) =>
                            setSelectedIds((s) => (v ? [...s, k.id] : s.filter((x) => x !== k.id)))
                          }
                        />
                      </td>
                      {visibleCols.map((c, i) => {
                        const sticky = i === 0;
                        return (
                          <td
                            key={c.key}
                            className={cn(sticky && "sl")}
                            style={sticky ? { left: 72, minWidth: 240, maxWidth: 240 } : undefined}
                            title={typeof k[c.key as keyof SshKey] === "string" ? String(k[c.key as keyof SshKey]) : undefined}
                          >
                            {renderCell(k, c.key, { onCertClick: () => setCertsForKey(k) })}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={visibleCols.length + 2} style={{ height: "auto", whiteSpace: "normal", overflow: "visible", maxWidth: "none", background: "#F8FAFC", padding: "12px 48px" }}>
                          <div className="grid grid-cols-3 gap-6 text-[12px]">
                            <KV label="Fingerprint" value={<span className="font-mono break-all">{k.fingerprint}</span>} />
                            <KV label="File Paths" value={k.filePaths.join(", ") || "--"} />
                            <KV label="All Endpoints" value={[...k.clientEndpoints, ...k.hostEndpoints].join(", ") || "--"} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Row>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length + 2} style={{ height: "auto", whiteSpace: "normal", textAlign: "center", padding: "48px", color: "var(--color-muted-foreground)", maxWidth: "none" }}>
                    No keys match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="inv-pagination">
          <span className="mr-2">
            {filtered.length === 0 ? 0 : (page - 1) * PAGE + 1} to {Math.min(page * PAGE, filtered.length)} of {filtered.length}
          </span>
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</Button>
          <Button size="sm" variant="ghost" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>›</Button>
        </div>
      </div>

      <ColumnPicker open={colPickerOpen} onClose={() => setColPickerOpen(false)} columns={ALL_COLUMNS} selected={cols} onSave={setCols} />

      <CertificatesOfKeyModal
        ssKey={certsForKey}
        onClose={() => setCertsForKey(null)}
        onSelectCert={(c) => { setCertsForKey(null); setDrawerCert(c); }}
      />

      <CertDetailDrawer cert={drawerCert} onClose={() => setDrawerCert(null)} />

      <ProvisionDialog ssKey={provisionFor} onClose={() => setProvisionFor(null)} onProvisioned={(id) => updateKey(id, { hasCert: true, certCount: 1 })} />
      <RotateKeyDialog ssKey={rotateFor} onClose={() => setRotateFor(null)} onDone={(id) => updateKey(id, { age: "0 days" })} />
      <DeleteKeyWithCertDialog ssKey={deleteWithCertFor} onClose={() => setDeleteWithCertFor(null)} onDone={(id) => removeKey(id)} />

      <ConfirmDialog
        open={!!confirmDeleteOnly}
        title={`Delete ${confirmDeleteOnly?.name ?? ""}?`}
        description="This will remove the key from AVX inventory and all endpoints."
        destructive confirmLabel="Yes"
        onClose={() => setConfirmDeleteOnly(null)}
        onConfirm={() => { if (confirmDeleteOnly) { removeKey(confirmDeleteOnly.id); toast.success(`Key "${confirmDeleteOnly.name}" deleted.`); } setConfirmDeleteOnly(null); }}
      />

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revoke SSH Key"
        description={`Are you sure you want to revoke "${confirmRevoke?.name ?? ""}"? This action cannot be undone.`}
        destructive confirmLabel="Yes, Revoke"
        onClose={() => setConfirmRevoke(null)}
        onConfirm={() => { if (confirmRevoke) { updateKey(confirmRevoke.id, { status: "Revoked" }); toast.success(`Key "${confirmRevoke.name}" revoked.`); } setConfirmRevoke(null); }}
      />

      <ConfirmDialog
        open={!!statusChangeFor}
        title={`Change status of ${statusChangeFor?.name ?? ""}`}
        description={
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-[13px]"><input type="radio" checked={statusNew === "Active"} onChange={() => setStatusNew("Active")} /> Active</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="radio" checked={statusNew === "Inactive"} onChange={() => setStatusNew("Inactive")} /> Inactive</label>
          </div>
        }
        confirmLabel="Save"
        onClose={() => setStatusChangeFor(null)}
        onConfirm={() => { if (statusChangeFor) { updateKey(statusChangeFor.id, { status: statusNew }); toast.success("Status updated."); } setStatusChangeFor(null); }}
      />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase-tracking text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[12px]">{value}</div>
    </div>
  );
}

function renderCell(k: SshKey, col: string, opts: { onCertClick: () => void }): React.ReactNode {
  switch (col) {
    case "name":
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">{k.name}</span>
          {k.hasCert && (
            <button onClick={opts.onCertClick} className="p-0.5 rounded hover:bg-primary/10 text-primary" title={`${k.certCount} certificate(s)`}>
              <Link2 className="h-3.5 w-3.5" />
            </button>
          )}
          <Shield className="h-3 w-3 text-muted-foreground" />
          <ClipboardList className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className={cn("text-[10px] h-4 px-1", COMBO_BADGE_CLASS[k.combination])} title="Discovered combination">
            {COMBO_LABEL[k.combination]}
          </Badge>
        </div>
      );
    case "associatedUsers": return <Truncated items={k.associatedUsers} />;
    case "clientEndpoints": return <Truncated items={k.clientEndpoints} mono />;
    case "hostEndpoints":   return <Truncated items={k.hostEndpoints} mono />;
    case "age":             return <span>{k.age || "--"}</span>;
    case "encryption":      return <Badge variant="outline">{k.encryption}</Badge>;
    case "length":          return <span>{k.length}</span>;
    case "fingerprint":     return <span className="font-mono text-[11px]">{k.fingerprint.slice(0, 18)}…</span>;
    case "comment":         return <span className="text-muted-foreground">{k.comment || "--"}</span>;
    case "keyComplianceGroup": return <Badge variant="outline">{k.keyComplianceGroup}</Badge>;
    case "status":
      return (
        <Badge variant="outline" className={cn(k.status === "Active" && "bg-risk-green/15 text-risk-green border-risk-green/30", k.status === "Inactive" && "bg-muted text-muted-foreground", k.status === "Revoked" && "bg-muted text-muted-foreground border-border")}>
          {k.status}
        </Badge>
      );
    case "filePaths":       return <span className="text-[11px] font-mono">{k.filePaths.join(", ") || "--"}</span>;
    case "riskStatus":      return <Badge variant="outline" className={riskColor(k.riskStatus)}>{k.riskStatus}</Badge>;
    case "complianceStatus":
      return (
        <Badge variant="outline" className={cn(k.complianceStatus === "Compliant" ? "bg-risk-green/15 text-risk-green border-risk-green/30" : "bg-risk-red/15 text-risk-red border-risk-red/30")}>
          {k.complianceStatus}
        </Badge>
      );
    default: return null;
  }
}

function Truncated({ items, mono }: { items: string[]; mono?: boolean }) {
  if (items.length === 0) return <span className="text-muted-foreground">--</span>;
  return (
    <div className="flex items-center gap-1">
      <span className={cn(mono && "font-mono text-[12px]")}>{items[0]}</span>
      {items.length > 1 && <Badge variant="outline" className="h-5 text-[10px]">+{items.length - 1}</Badge>}
    </div>
  );
}

export { Link };