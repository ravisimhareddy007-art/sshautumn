import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiskTileBar, type RiskTileDef } from "@/components/common/RiskTileBar";
import { ColumnPicker, type ColumnDef } from "@/components/common/ColumnPicker";
import { FilterChips } from "@/components/common/FilterChips";
import { ProvisionDialog } from "@/components/key/ProvisionDialog";
import { RotateKeyDialog } from "@/components/key/RotateKeyDialog";
import { DeleteKeyWithCertDialog } from "@/components/key/DeleteKeyWithCertDialog";
import { CertificatesOfKeyModal } from "@/components/key/CertificatesOfKeyModal";
import { MigrateToCertDialog } from "@/components/key/MigrateToCertDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CertDetailDrawer } from "@/components/cert/CertDetailDrawer";
import { usePersistedState } from "@/hooks/use-persisted-state";
import type { SshKey, SshCert, RiskStatus, MigrationStatus } from "@/data/mock";
import {
  riskColor,
  GROUPS,
  USER_CERTS,
  migrationDaysElapsed,
  migrationDaysRemaining,
  isMigrationCertExpired,
  isMigrationCertExpiringSoon,
  migrationStatusColor,
  migrationStatusLabel,
} from "@/data/mock";
import {
  ChevronDown,
  ChevronRight,
  Columns,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ClipboardList,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  rotateKeyAction,
  provisionCertAction,
  certRevokeAction,
  COMBO_LABEL,
  COMBO_BADGE_CLASS,
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

// Rollback retention window in days — after decommission, rollback available for this long
const ROLLBACK_RETENTION_DAYS = 30;

export function KeyInventoryPage(props: KeyInventoryProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { highlight?: string };

  const [keys, setKeys] = useState<SshKey[]>(props.initialKeys);
  const [group, setGroup] = useState("All Keys");
  const [search_, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskStatus | null>(null);
  const [migrationFilter, setMigrationFilter] = useState<MigrationStatus | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cols, setCols] = usePersistedState<string[]>(
    `kcols-${props.scope}`,
    props.scope === "user" ? DEFAULT_USER_COLS : DEFAULT_HOST_COLS,
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Existing dialogs
  const [certsForKey, setCertsForKey] = useState<SshKey | null>(null);
  const [provisionFor, setProvisionFor] = useState<SshKey | null>(null);
  const [rotateFor, setRotateFor] = useState<SshKey | null>(null);
  const [deleteWithCertFor, setDeleteWithCertFor] = useState<SshKey | null>(null);
  const [confirmDeleteOnly, setConfirmDeleteOnly] = useState<SshKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<SshKey | null>(null);
  const [statusChangeFor, setStatusChangeFor] = useState<SshKey | null>(null);
  const [statusNew, setStatusNew] = useState<"Active" | "Inactive">("Active");
  const [drawerCert, setDrawerCert] = useState<SshCert | null>(null);

  // Migration dialogs
  const [migrateFor, setMigrateFor] = useState<SshKey | null>(null);
  const [confirmDecommission, setConfirmDecommission] = useState<SshKey | null>(null);
  const [confirmExtend, setConfirmExtend] = useState<SshKey | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<SshKey | null>(null);

  const filtered = useMemo(() => {
    let list = keys;
    if (group !== "All Keys") list = list.filter((k) => k.keyComplianceGroup === group);
    if (riskFilter) list = list.filter((k) => k.riskStatus === riskFilter);
    if (migrationFilter) list = list.filter((k) => k.migrationStatus === migrationFilter);
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
  }, [keys, group, riskFilter, migrationFilter, search_]);

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

  // Migration summary counts
  const migrationCounts = useMemo(
    () => ({
      in_coexistence: keys.filter((k) => k.migrationStatus === "in_coexistence").length,
      awaiting_confirmation: keys.filter((k) => k.migrationStatus === "awaiting_confirmation").length,
      decommissioned: keys.filter((k) => k.migrationStatus === "decommissioned").length,
      critical: keys.filter((k) => isMigrationCertExpired(k, USER_CERTS)).length,
    }),
    [keys],
  );

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

  // Migration action handlers
  const handleMigrated = (
    id: string,
    data: {
      migrationIssuedAt: string;
      migrationWindowDays: number;
      migrationPostWindowAction: "manual" | "auto";
      migrationHostEndpoint?: string;
      migrationCertId?: string;
    },
  ) => {
    const key = keys.find((k) => k.id === id);
    updateKey(id, {
      hasCert: true,
      certCount: (key?.certCount ?? 0) + 1,
      combination: "private_cert",
      migrationStatus: "in_coexistence",
      ...data,
    });
  };

  const handleConfirmDecommission = (key: SshKey) => {
    updateKey(key.id, { migrationStatus: "decommissioned" });
    toast.success(`"${key.name}" decommissioned. Original key entry removed. Cert is now the sole auth path.`);
    setConfirmDecommission(null);
  };

  const handleExtendWindow = (key: SshKey) => {
    const today = new Date().toISOString().slice(0, 10);
    updateKey(key.id, {
      migrationStatus: "in_coexistence",
      migrationIssuedAt: today,
    });
    toast.success(`Coexistence window extended by ${key.migrationWindowDays ?? 14} days for "${key.name}".`);
    setConfirmExtend(null);
  };

  const handleRollback = (key: SshKey) => {
    updateKey(key.id, {
      migrationStatus: "rolled_back",
      hasCert: Math.max(0, (key.certCount ?? 1) - 1) > 0,
      certCount: Math.max(0, (key.certCount ?? 1) - 1),
      combination: key.certCount === 1 ? "private_public" : "private_cert",
    });
    toast.success(`Migration rolled back for "${key.name}". Original authorized_keys entry restored.`);
    setConfirmRollback(null);
  };

  const chips = [
    riskFilter ? { key: "risk", label: `Risk: ${riskFilter}` } : null,
    migrationFilter ? { key: "migration", label: `Migration: ${migrationStatusLabel[migrationFilter]}` } : null,
    search.highlight ? { key: "highlight", label: `Highlight: ${search.highlight}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const sel = selectedKeys[0];

  // Determine what migration actions to show for selected key
  const showMigrateAction = (sel && !sel.migrationStatus) || sel?.migrationStatus === "rolled_back";
  const showConfirmDecommission = sel?.migrationStatus === "awaiting_confirmation";
  const showExtendWindow = sel?.migrationStatus === "awaiting_confirmation";
  const showRollback =
    sel?.migrationStatus === "in_coexistence" ||
    sel?.migrationStatus === "awaiting_confirmation" ||
    (sel?.migrationStatus === "decommissioned" &&
      sel.migrationIssuedAt &&
      migrationDaysElapsed(sel.migrationIssuedAt) <= (sel.migrationWindowDays ?? 14) + ROLLBACK_RETENTION_DAYS);

  return (
    <div>
      <PageHeader breadcrumbs={props.breadcrumbs} title={props.title} />

      <RiskTileBar
        tiles={tiles}
        activeKey={riskFilter}
        onSelect={(k) => {
          setRiskFilter((curr) => (curr === k ? null : (k as RiskStatus)));
          setMigrationFilter(null);
          setPage(1);
        }}
      />

      {/* Migration status tiles — only shown when migrations exist */}
      {(migrationCounts.in_coexistence > 0 ||
        migrationCounts.awaiting_confirmation > 0 ||
        migrationCounts.decommissioned > 0 ||
        migrationCounts.critical > 0) && (
        <div className="flex gap-3 px-1 pb-3">
          {migrationCounts.in_coexistence > 0 && (
            <button
              onClick={() => {
                setMigrationFilter((f) => (f === "in_coexistence" ? null : "in_coexistence"));
                setRiskFilter(null);
                setPage(1);
              }}
              className={cn(
                "flex flex-col px-4 py-2 rounded-md border text-left transition-colors",
                migrationFilter === "in_coexistence"
                  ? "bg-risk-amber/10 border-risk-amber"
                  : "bg-surface border-border hover:border-risk-amber/50",
              )}
            >
              <span className="text-[18px] font-bold text-risk-amber leading-tight">
                {migrationCounts.in_coexistence}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">In Migration</span>
            </button>
          )}
          {migrationCounts.awaiting_confirmation > 0 && (
            <button
              onClick={() => {
                setMigrationFilter((f) => (f === "awaiting_confirmation" ? null : "awaiting_confirmation"));
                setRiskFilter(null);
                setPage(1);
              }}
              className={cn(
                "flex flex-col px-4 py-2 rounded-md border text-left transition-colors",
                migrationFilter === "awaiting_confirmation"
                  ? "bg-risk-red/10 border-risk-red"
                  : "bg-surface border-risk-red/30 hover:border-risk-red",
              )}
            >
              <span className="text-[18px] font-bold text-risk-red leading-tight">
                {migrationCounts.awaiting_confirmation}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-risk-red mt-0.5">Awaiting Confirmation</span>
            </button>
          )}
          {migrationCounts.critical > 0 && (
            <button
              onClick={() =>
                toast.error("Filter: keys where migration cert has expired. Renew certs immediately to restore access.")
              }
              className="flex flex-col px-4 py-2 rounded-md border bg-risk-red/5 border-risk-red text-left animate-pulse"
            >
              <span className="text-[18px] font-bold text-risk-red leading-tight">⚠ {migrationCounts.critical}</span>
              <span className="text-[10px] uppercase tracking-wider text-risk-red mt-0.5">Critical — Cert Expired</span>
            </button>
          )}
          {migrationCounts.decommissioned > 0 && (
            <button
              onClick={() => {
                setMigrationFilter((f) => (f === "decommissioned" ? null : "decommissioned"));
                setRiskFilter(null);
                setPage(1);
              }}
              className={cn(
                "flex flex-col px-4 py-2 rounded-md border text-left transition-colors",
                migrationFilter === "decommissioned"
                  ? "bg-risk-green/10 border-risk-green"
                  : "bg-surface border-border hover:border-risk-green/50",
              )}
            >
              <span className="text-[18px] font-bold text-risk-green leading-tight">
                {migrationCounts.decommissioned}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Migrated</span>
            </button>
          )}
        </div>
      )}

      <FilterChips
        chips={chips}
        onRemove={(k) => {
          if (k === "risk") setRiskFilter(null);
          if (k === "migration") setMigrationFilter(null);
          if (k === "highlight") navigate({ to: ".", search: {} as never });
        }}
      />

      <div className="flex items-center gap-2 bg-surface border border-border rounded-t-md px-3 py-2">
        <span className="text-[12px] text-muted-foreground">Groups</span>
        <Select
          value={group}
          onValueChange={(v) => {
            setGroup(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-[160px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Keys">All Keys</SelectItem>
            {GROUPS.filter((g) => g !== "All Groups").map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-md ml-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 pr-8 h-8 text-[13px]"
            placeholder="Type your search and press Enter…"
            value={search_}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
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
              {sel && (
                <div className="px-2 py-1.5 mb-1 border-b border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Combination</span>
                  <div
                    className={cn(
                      "mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded border inline-block",
                      COMBO_BADGE_CLASS[sel.combination],
                    )}
                  >
                    {COMBO_LABEL[sel.combination]}
                  </div>
                </div>
              )}

              {/* Standard actions */}
              <DropdownMenuItem onClick={() => toast.success("Key updated.")}>Modify</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (sel) {
                    setStatusChangeFor(sel);
                    setStatusNew(sel.status === "Active" ? "Inactive" : "Active");
                  }
                }}
              >
                Change Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`Exported ${selectedKeys.length} key(s) to CSV.`)}>
                Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Key file download started.")}>Download</DropdownMenuItem>

              {/* Provision Certificate */}
              {(() => {
                const a = sel ? provisionCertAction(sel.combination) : { show: false, enabled: false };
                if (!a.show) return null;
                if (!a.enabled)
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem disabled>
                          <span className="pointer-events-auto">Provision Certificate</span>
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        {a.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  );
                return <DropdownMenuItem onClick={() => setProvisionFor(sel)}>Provision Certificate</DropdownMenuItem>;
              })()}

              {/* Rotate Key */}
              {(() => {
                const a = sel ? rotateKeyAction(sel.combination) : { show: false, enabled: false };
                if (!a.show) return null;
                if (!a.enabled)
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem disabled>
                          <span className="pointer-events-auto">Rotate Key</span>
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        {a.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  );
                return <DropdownMenuItem onClick={() => setRotateFor(sel)}>Rotate Key</DropdownMenuItem>;
              })()}

              {/* Revoke Cert */}
              {(() => {
                const combo = sel?.combination;
                const hasCert = sel?.hasCert;
                if (!hasCert || (combo !== "private_cert" && combo !== "public_cert")) return null;
                const a = sel
                  ? certRevokeAction(sel.status === "Revoked" ? "Revoked" : "Active")
                  : { show: false, enabled: false };
                if (!a.enabled)
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem disabled>
                          <span className="pointer-events-auto">Revoke Certificate</span>
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        {a.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  );
                return <DropdownMenuItem onClick={() => setConfirmRevoke(sel)}>Revoke Certificate</DropdownMenuItem>;
              })()}

              <DropdownMenuItem disabled>Rollback</DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* ── Migration actions (contextual) ── */}

              {/* Migrate to Certificate — shown when not yet in migration */}
              {showMigrateAction && (
                <DropdownMenuItem
                  onClick={() => setMigrateFor(sel)}
                  className="font-medium text-primary focus:text-primary"
                >
                  {sel?.migrationStatus === "rolled_back" ? "Restart Migration" : "Migrate to Certificate"}
                  <Badge
                    variant="outline"
                    className="ml-auto text-[9px] h-4 px-1 text-primary border-primary/30 bg-primary/10"
                  >
                    {sel?.migrationStatus === "rolled_back" ? "↺" : "NEW"}
                  </Badge>
                </DropdownMenuItem>
              )}

              {/* Confirm Decommission — shown for awaiting_confirmation */}
              {showConfirmDecommission && (
                <DropdownMenuItem
                  onClick={() => setConfirmDecommission(sel)}
                  className="font-medium text-risk-green focus:text-risk-green"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Confirm Decommission
                </DropdownMenuItem>
              )}

              {/* Extend Window — shown for awaiting_confirmation */}
              {showExtendWindow && (
                <DropdownMenuItem onClick={() => setConfirmExtend(sel)}>
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Extend Coexistence Window
                </DropdownMenuItem>
              )}

              {/* Rollback Migration — shown for in_coexistence, awaiting_confirmation, decommissioned (within retention) */}
              {showRollback && (
                <DropdownMenuItem onClick={() => setConfirmRollback(sel)} className="text-risk-red focus:text-risk-red">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Rollback Migration
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Delete */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Delete</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setConfirmDeleteOnly(sel)}>Delete Key Only</DropdownMenuItem>
                    <DropdownMenuItem disabled={!sel?.hasCert} onClick={() => setDeleteWithCertFor(sel)}>
                      Delete Key + Certificate
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuItem onClick={() => toast.success("Tags uploaded successfully.")}>
                Upload Bulk Tags
              </DropdownMenuItem>
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
                const certExpired = isMigrationCertExpired(k, USER_CERTS);
                const certExpiringSoon = isMigrationCertExpiringSoon(k, USER_CERTS);
                return (
                  <Row key={k.id}>
                    <tr
                      className={cn(
                        isSelected && "row-selected",
                        isHighlighted && "row-highlight",
                        certExpired && "bg-risk-red/5",
                      )}
                    >
                      <td className="sl" style={{ left: 0, width: 36, minWidth: 36 }}>
                        <button
                          className="p-0.5 hover:bg-muted rounded inline-flex"
                          onClick={() => setExpanded((e) => ({ ...e, [k.id]: !e[k.id] }))}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
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
                            title={
                              typeof k[c.key as keyof SshKey] === "string"
                                ? String(k[c.key as keyof SshKey])
                                : undefined
                            }
                          >
                            {renderCell(k, c.key, {
                              onCertClick: () => setCertsForKey(k),
                            })}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Critical lockout warning row */}
                    {certExpired && (
                      <tr>
                        <td
                          colSpan={visibleCols.length + 2}
                          style={{
                            height: "auto",
                            maxWidth: "none",
                            padding: "0 48px 6px",
                            background: "rgba(239,68,68,0.05)",
                          }}
                        >
                          <div className="flex items-center gap-2 py-1.5 px-3 bg-risk-red/10 border border-risk-red/30 rounded text-[12px] text-risk-red">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              <strong>Critical:</strong> This key was decommissioned and its migration certificate has
                              expired. Access to <strong>{k.migrationHostEndpoint}</strong> via certificate may be
                              broken. Renew the migration certificate immediately.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Cert expiring soon warning row */}
                    {!certExpired && certExpiringSoon && (
                      <tr>
                        <td
                          colSpan={visibleCols.length + 2}
                          style={{ height: "auto", maxWidth: "none", padding: "0 48px 6px" }}
                        >
                          <div className="flex items-center gap-2 py-1.5 px-3 bg-risk-amber/10 border border-risk-amber/30 rounded text-[12px] text-risk-amber">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Migration cert expiring soon on <strong>{k.migrationHostEndpoint}</strong>. The original
                              key entry has been removed — renew the cert before it expires or the user will be locked
                              out.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={visibleCols.length + 2}
                          style={{
                            height: "auto",
                            whiteSpace: "normal",
                            overflow: "visible",
                            maxWidth: "none",
                            background: "#F8FAFC",
                            padding: "12px 48px",
                          }}
                        >
                          <div className="grid grid-cols-3 gap-6 text-[12px]">
                            <KV
                              label="Fingerprint"
                              value={<span className="font-mono break-all">{k.fingerprint}</span>}
                            />
                            <KV label="File Paths" value={k.filePaths.join(", ") || "--"} />
                            <KV
                              label="All Endpoints"
                              value={[...k.clientEndpoints, ...k.hostEndpoints].join(", ") || "--"}
                            />
                          </div>

                          {/* Migration detail section in expanded row */}
                          {k.migrationStatus && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                                Migration Status
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-[12px]">
                                <KV
                                  label="Status"
                                  value={
                                    <Badge
                                      variant="outline"
                                      className={cn("text-[11px]", migrationStatusColor(k.migrationStatus))}
                                    >
                                      {migrationStatusLabel[k.migrationStatus]}
                                    </Badge>
                                  }
                                />
                                <KV label="Host" value={k.migrationHostEndpoint ?? "--"} />
                                <KV label="Issued" value={k.migrationIssuedAt ?? "--"} />
                                {k.migrationStatus === "in_coexistence" &&
                                  k.migrationIssuedAt &&
                                  k.migrationWindowDays && (
                                    <>
                                      <KV
                                        label="Window"
                                        value={`Day ${migrationDaysElapsed(k.migrationIssuedAt)} of ${k.migrationWindowDays}`}
                                      />
                                      <KV
                                        label="Remaining"
                                        value={`${migrationDaysRemaining(k.migrationIssuedAt, k.migrationWindowDays)} days`}
                                      />
                                      <KV
                                        label="Post-window"
                                        value={
                                          k.migrationPostWindowAction === "manual"
                                            ? "Manual Confirmation"
                                            : "Auto-Deactivate"
                                        }
                                      />
                                    </>
                                  )}
                                {k.migrationStatus === "awaiting_confirmation" && (
                                  <>
                                    <KV
                                      label="Window closed"
                                      value={
                                        k.migrationIssuedAt
                                          ? `${migrationDaysElapsed(k.migrationIssuedAt) - (k.migrationWindowDays ?? 14)} days ago`
                                          : "--"
                                      }
                                    />
                                    <KV
                                      label="Action required"
                                      value={
                                        <span className="text-risk-red font-medium">
                                          Confirm Decommission or Extend
                                        </span>
                                      }
                                    />
                                  </>
                                )}
                                {k.migrationRollbackStoredLine && (
                                  <div className="col-span-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">
                                      Stored authorized_keys line (for rollback)
                                    </div>
                                    <code className="text-[11px] bg-muted px-2 py-1 rounded block font-mono break-all">
                                      {k.migrationRollbackStoredLine}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Row>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleCols.length + 2}
                    style={{
                      height: "auto",
                      whiteSpace: "normal",
                      textAlign: "center",
                      padding: "48px",
                      color: "var(--color-muted-foreground)",
                      maxWidth: "none",
                    }}
                  >
                    No keys match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="inv-pagination">
          <span className="mr-2">
            {filtered.length === 0 ? 0 : (page - 1) * PAGE + 1} to {Math.min(page * PAGE, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            ›
          </Button>
        </div>
      </div>

      <ColumnPicker
        open={colPickerOpen}
        onClose={() => setColPickerOpen(false)}
        columns={ALL_COLUMNS}
        selected={cols}
        onSave={setCols}
      />

      <CertificatesOfKeyModal
        ssKey={certsForKey}
        onClose={() => setCertsForKey(null)}
        onSelectCert={(c) => {
          setCertsForKey(null);
          setDrawerCert(c);
        }}
      />

      <CertDetailDrawer cert={drawerCert} onClose={() => setDrawerCert(null)} />

      <ProvisionDialog
        ssKey={provisionFor}
        onClose={() => setProvisionFor(null)}
        onProvisioned={(id) => updateKey(id, { hasCert: true, certCount: 1 })}
      />
      <RotateKeyDialog
        ssKey={rotateFor}
        onClose={() => setRotateFor(null)}
        onDone={(id) => updateKey(id, { age: "0 days" })}
      />
      <DeleteKeyWithCertDialog
        ssKey={deleteWithCertFor}
        onClose={() => setDeleteWithCertFor(null)}
        onDone={(id) => removeKey(id)}
      />

      {/* Migration wizard */}
      <MigrateToCertDialog ssKey={migrateFor} onClose={() => setMigrateFor(null)} onMigrated={handleMigrated} />

      {/* Confirm Decommission */}
      <ConfirmDialog
        open={!!confirmDecommission}
        title="Confirm Decommission"
        description={
          <div className="space-y-3 text-[13px]">
            <p>
              The migration certificate for <strong>{confirmDecommission?.name}</strong> has been active through the
              coexistence window. Confirming will:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                Remove the original authorized_keys entry from{" "}
                <strong>{confirmDecommission?.migrationHostEndpoint}</strong>
              </li>
              <li>Mark the certificate as the sole authentication path</li>
              <li>Store the original line for rollback (available for {ROLLBACK_RETENTION_DAYS} days)</li>
            </ul>
          </div>
        }
        confirmLabel="Confirm Decommission"
        onClose={() => setConfirmDecommission(null)}
        onConfirm={() => confirmDecommission && handleConfirmDecommission(confirmDecommission)}
      />

      {/* Extend Window */}
      <ConfirmDialog
        open={!!confirmExtend}
        title="Extend Coexistence Window"
        description={`Start a new ${confirmExtend?.migrationWindowDays ?? 14}-day coexistence window for "${confirmExtend?.name ?? ""}". Both the original key and the certificate will remain active. You will be notified again when the new window closes.`}
        confirmLabel="Extend Window"
        onClose={() => setConfirmExtend(null)}
        onConfirm={() => confirmExtend && handleExtendWindow(confirmExtend)}
      />

      {/* Rollback Migration */}
      <ConfirmDialog
        open={!!confirmRollback}
        title="Rollback Migration"
        description={
          <div className="space-y-2 text-[13px]">
            <p>
              Rolling back will restore the original authorized_keys entry for <strong>{confirmRollback?.name}</strong>{" "}
              on <strong>{confirmRollback?.migrationHostEndpoint}</strong> and mark this migration as rolled back.
            </p>
            {confirmRollback?.migrationStatus === "decommissioned" && (
              <p className="text-risk-amber">
                Note: The migration certificate will remain valid and can still be used until it expires. Only the
                authorized_keys entry is being restored.
              </p>
            )}
          </div>
        }
        destructive
        confirmLabel="Rollback"
        onClose={() => setConfirmRollback(null)}
        onConfirm={() => confirmRollback && handleRollback(confirmRollback)}
      />

      <ConfirmDialog
        open={!!confirmDeleteOnly}
        title={`Delete ${confirmDeleteOnly?.name ?? ""}?`}
        description="This will remove the key from AVX inventory and all endpoints."
        destructive
        confirmLabel="Yes"
        onClose={() => setConfirmDeleteOnly(null)}
        onConfirm={() => {
          if (confirmDeleteOnly) {
            removeKey(confirmDeleteOnly.id);
            toast.success(`Key "${confirmDeleteOnly.name}" deleted.`);
          }
          setConfirmDeleteOnly(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revoke SSH Key"
        description={`Are you sure you want to revoke "${confirmRevoke?.name ?? ""}"? This action cannot be undone.`}
        destructive
        confirmLabel="Yes, Revoke"
        onClose={() => setConfirmRevoke(null)}
        onConfirm={() => {
          if (confirmRevoke) {
            updateKey(confirmRevoke.id, { status: "Revoked" });
            toast.success(`Key "${confirmRevoke.name}" revoked.`);
          }
          setConfirmRevoke(null);
        }}
      />

      <ConfirmDialog
        open={!!statusChangeFor}
        title={`Change status of ${statusChangeFor?.name ?? ""}`}
        description={
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="radio" checked={statusNew === "Active"} onChange={() => setStatusNew("Active")} /> Active
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="radio" checked={statusNew === "Inactive"} onChange={() => setStatusNew("Inactive")} />{" "}
              Inactive
            </label>
          </div>
        }
        confirmLabel="Save"
        onClose={() => setStatusChangeFor(null)}
        onConfirm={() => {
          if (statusChangeFor) {
            updateKey(statusChangeFor.id, { status: statusNew });
            toast.success("Status updated.");
          }
          setStatusChangeFor(null);
        }}
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
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate max-w-[140px]" title={k.name}>
              {k.name}
            </span>
            {k.hasCert && (
              <button
                onClick={opts.onCertClick}
                className="p-0.5 rounded hover:bg-primary/10 text-primary"
                title={`${k.certCount} certificate(s)`}
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            )}
            <Shield className="h-3 w-3 text-muted-foreground" />
            <ClipboardList className="h-3 w-3 text-muted-foreground" />
            <Badge
              variant="outline"
              className={cn("text-[10px] h-4 px-1", COMBO_BADGE_CLASS[k.combination])}
              title="Discovered combination"
            >
              {COMBO_LABEL[k.combination]}
            </Badge>
          </div>

          {/* Migration status indicator */}
          {k.migrationStatus && (
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                {k.migrationStatus === "in_coexistence" && <ArrowRight className="h-3 w-3 text-risk-amber" />}
                {k.migrationStatus === "awaiting_confirmation" && <AlertTriangle className="h-3 w-3 text-risk-red" />}
                {k.migrationStatus === "decommissioned" && <CheckCircle2 className="h-3 w-3 text-risk-green" />}
                {k.migrationStatus === "rolled_back" && <RotateCcw className="h-3 w-3 text-muted-foreground" />}
                <Badge variant="outline" className={cn("text-[9px] h-4 px-1", migrationStatusColor(k.migrationStatus))}>
                  {migrationStatusLabel[k.migrationStatus]}
                </Badge>
                {k.migrationStatus === "in_coexistence" && k.migrationIssuedAt && k.migrationWindowDays && (
                  <span className="text-[10px] text-muted-foreground">
                    Day {migrationDaysElapsed(k.migrationIssuedAt)} of {k.migrationWindowDays}
                  </span>
                )}
                {k.migrationStatus === "awaiting_confirmation" && k.migrationIssuedAt && k.migrationWindowDays && (
                  <span className="text-[10px] text-risk-red">
                    {migrationDaysElapsed(k.migrationIssuedAt) - k.migrationWindowDays}d overdue
                  </span>
                )}
              </div>
              {/* Progress bar for coexistence window */}
              {k.migrationStatus === "in_coexistence" && k.migrationIssuedAt && k.migrationWindowDays && (
                <div className="h-1 w-24 bg-muted rounded-full">
                  <div
                    className="h-1 bg-risk-amber rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (migrationDaysElapsed(k.migrationIssuedAt) / k.migrationWindowDays) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Critical edge case inline warning */}
          {isMigrationCertExpired(k, USER_CERTS) && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-risk-red font-medium">
              <AlertTriangle className="h-3 w-3" /> Cert expired — potential lockout
            </div>
          )}
        </div>
      );
    case "associatedUsers":
      return <Truncated items={k.associatedUsers} />;
    case "clientEndpoints":
      return <Truncated items={k.clientEndpoints} mono />;
    case "hostEndpoints":
      return <Truncated items={k.hostEndpoints} mono />;
    case "age":
      return <span>{k.age || "--"}</span>;
    case "encryption":
      return <Badge variant="outline">{k.encryption}</Badge>;
    case "length":
      return <span>{k.length}</span>;
    case "fingerprint":
      return <span className="font-mono text-[11px]">{k.fingerprint.slice(0, 18)}…</span>;
    case "comment":
      return <span className="text-muted-foreground">{k.comment || "--"}</span>;
    case "keyComplianceGroup":
      return <Badge variant="outline">{k.keyComplianceGroup}</Badge>;
    case "status":
      return (
        <Badge
          variant="outline"
          className={cn(
            k.status === "Active" && "bg-risk-green/15 text-risk-green border-risk-green/30",
            k.status === "Inactive" && "bg-muted text-muted-foreground",
            k.status === "Revoked" && "bg-muted text-muted-foreground border-border",
          )}
        >
          {k.status}
        </Badge>
      );
    case "filePaths":
      return <span className="text-[11px] font-mono">{k.filePaths.join(", ") || "--"}</span>;
    case "riskStatus":
      return (
        <Badge variant="outline" className={riskColor(k.riskStatus)}>
          {k.riskStatus}
        </Badge>
      );
    case "complianceStatus":
      return (
        <Badge
          variant="outline"
          className={cn(
            k.complianceStatus === "Compliant"
              ? "bg-risk-green/15 text-risk-green border-risk-green/30"
              : "bg-risk-red/15 text-risk-red border-risk-red/30",
          )}
        >
          {k.complianceStatus}
        </Badge>
      );
    default:
      return null;
  }
}

function Truncated({ items, mono }: { items: string[]; mono?: boolean }) {
  if (items.length === 0) return <span className="text-muted-foreground">--</span>;
  return (
    <div className="flex items-center gap-1">
      <span className={cn(mono && "font-mono text-[12px]")}>{items[0]}</span>
      {items.length > 1 && (
        <Badge variant="outline" className="h-5 text-[10px]">
          +{items.length - 1}
        </Badge>
      )}
    </div>
  );
}

export { Link };
