import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  Columns,
  Info,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ColumnPicker, type ColumnDef } from "@/components/common/ColumnPicker";
import { FilterChips } from "@/components/common/FilterChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { cn } from "@/lib/utils";
import {
  fmtDate,
  keyIdOf,
  PGP_GROUPS,
  shortFp,
  type OwnKey,
  type PgpKey,
  type TrustedKey,
} from "@/data/pgp";
import {
  algoLabel,
  ownActionAvailability,
  trustedActionAvailability,
  withinWindow,
  type OwnAction,
  type TrustedAction,
} from "@/lib/pgp-rules";
import {
  confirmCutover,
  deleteTrusted,
  keyName,
  publishOwn,
  reactivate,
  thresholdFor,
  usePgp,
} from "@/lib/pgp-store";
import {
  ActionItem,
  ComplianceCell,
  derive,
  KV,
  NextExpiryCell,
  Pill,
  PurposeList,
  RiskList,
  StatusBadge,
  type Derived,
} from "./pgp-ui";
import { PgpDetailDrawer } from "./PgpDetailDrawer";
import {
  createRevCertNow,
  DecideDialog,
  DeleteOwnDialog,
  DistributeDialog,
  DownloadPrivateDialog,
  exportPublic,
  exportWkd,
  ExtendExpiryDialog,
  ImportKeyDialog,
  OnboardDialog,
  RemoveFromHostsDialog,
  RetireDialog,
  RevokeDialog,
  RotateSubkeyDialog,
} from "./PgpDialogs";

const OWN_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Key Name", mandatory: true },
  { key: "status", label: "Status" },
  { key: "purpose", label: "Purpose" },
  { key: "nextExpiry", label: "Next Expiry" },
  { key: "algorithm", label: "Algorithm" },
  { key: "hosts", label: "Hosts" },
  { key: "risk", label: "Risk" },
  { key: "compliance", label: "Compliance" },
  { key: "management", label: "Management" },
  { key: "storage", label: "Storage" },
  { key: "keyId", label: "Key ID" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "email", label: "Email" },
  { key: "publicCopies", label: "Public Copies" },
  { key: "revCert", label: "Revocation Certificate" },
  { key: "publication", label: "Publication" },
  { key: "group", label: "Key Group" },
  { key: "created", label: "Created" },
  { key: "lastDiscovered", label: "Last Discovered" },
];
const OWN_DEFAULT = [
  "name",
  "status",
  "purpose",
  "nextExpiry",
  "algorithm",
  "hosts",
  "risk",
  "compliance",
  "management",
];

const TRUSTED_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Key Name", mandatory: true },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "approval", label: "Approval" },
  { key: "purpose", label: "Purpose" },
  { key: "nextExpiry", label: "Next Expiry" },
  { key: "algorithm", label: "Algorithm" },
  { key: "hosts", label: "Hosts" },
  { key: "risk", label: "Risk" },
  { key: "keyId", label: "Key ID" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "email", label: "Email" },
  { key: "source", label: "Source" },
  { key: "group", label: "Key Group" },
  { key: "imported", label: "Imported By" },
  { key: "lastDiscovered", label: "Last Discovered" },
];
const TRUSTED_DEFAULT = [
  "name",
  "type",
  "status",
  "approval",
  "purpose",
  "nextExpiry",
  "algorithm",
  "hosts",
  "risk",
];

const OWN_TILES = ["Expired", "Expiring", "Weak", "Shared", "Rogue", "Misplaced"];
const TRUSTED_TILES = ["Expired", "Expiring", "Not approved", "Untrusted repository"];
const WINDOWS = [7, 30, 60, 90];
const PAGE = 25;

type Row = { k: PgpKey; d: Derived };

export function PgpInventoryPage({
  scope,
  initialTile,
  initialWindow,
}: {
  scope: "own" | "trusted";
  initialTile?: string;
  initialWindow?: number;
}) {
  const s = usePgp();
  const navigate = useNavigate();
  const own = scope === "own";
  const [group, setGroup] = useState("All Keys");
  const [statusF, setStatusF] = useState("All");
  const [mgmtF, setMgmtF] = useState("All");
  const [q, setQ] = useState("");
  const [tile, setTile] = useState<string | null>(
    initialTile && (scope === "own" ? OWN_TILES : TRUSTED_TILES).includes(initialTile)
      ? initialTile
      : null,
  );
  const [win, setWin] = usePersistedState<number>("pgp-window", 30);
  useEffect(() => {
    if (initialWindow && WINDOWS.includes(initialWindow)) setWin(initialWindow);
  }, [initialWindow]); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cols, setCols] = usePersistedState<string[]>(
    `pgp-cols-${scope}`,
    own ? OWN_DEFAULT : TRUSTED_DEFAULT,
  );
  const [colPicker, setColPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);

  // dialogs
  const [dlg, setDlg] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"From Inventory" | "From Hosts" | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    label: string;
    run: () => void;
    destructive?: boolean;
  } | null>(null);

  const all: PgpKey[] = own ? s.own : s.trusted;
  const rows: Row[] = useMemo(
    () => all.map((k) => ({ k, d: derive(k, s.policies) })),
    [all, s.policies],
  );

  const inTile = (r: Row, t: string) =>
    t === "Expiring" ? withinWindow(r.k, r.d.status, win) : r.d.risks.includes(t);

  const filtered = rows.filter((r) => {
    if (group !== "All Keys" && r.k.group !== group) return false;
    if (statusF !== "All" && r.d.status !== statusF) return false;
    if (own && mgmtF !== "All" && (r.k as OwnKey).management !== mgmtF) return false;
    if (!own && mgmtF !== "All" && (r.k as TrustedKey).type !== mgmtF) return false;
    if (tile && !inTile(r, tile)) return false;
    if (q.trim()) {
      const hay = [
        keyName(r.k),
        r.k.primary.fingerprint,
        ...r.k.userIds.map((u) => `${u.name} ${u.email ?? ""}`),
        ...(own
          ? (r.k as OwnKey).privateLocations.map((l) => l.host)
          : (r.k as TrustedKey).locations.map((l) => l.host)),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const visibleCols = (own ? OWN_COLUMNS : TRUSTED_COLUMNS).filter(
    (c) => c.mandatory || cols.includes(c.key),
  );

  const selOwn = s.own.filter((k) => selected.includes(k.id));
  const selTrusted = s.trusted.filter((k) => selected.includes(k.id));
  const one = own ? selOwn[0] : selTrusted[0];

  const ownCtx = {
    keyserver: s.settings.keyserver || null,
    threshold: (k: OwnKey) => thresholdFor(k),
  };
  const oa = (a: OwnAction) => ownActionAvailability(a, selOwn, ownCtx);
  const ta = (a: TrustedAction) =>
    trustedActionAvailability(a, selTrusted, {
      currentUser: "admin",
      threshold: (k) => thresholdFor(k),
      all: s.trusted,
    });

  const chips = [
    ...(tile
      ? [{ key: "tile", label: `Risk: ${tile === "Expiring" ? `Expiring in ${win} days` : tile}` }]
      : []),
    ...(statusF !== "All" ? [{ key: "status", label: `Status: ${statusF}` }] : []),
    ...(mgmtF !== "All"
      ? [{ key: "mgmt", label: `${own ? "Management" : "Type"}: ${mgmtF}` }]
      : []),
  ];
  const done = () => setDlg(null);
  const title = own ? "Own Keys" : "Trusted Keys";

  return (
    <div>
      <PageHeader breadcrumbs={["INVENTORY", "PGP KEY INVENTORY", title]} title={title} />

      {/* Risk tiles */}
      <div className="bg-surface border border-border rounded-md flex overflow-hidden mb-3">
        {(own ? OWN_TILES : TRUSTED_TILES).map((t, i) => {
          const count = rows.filter((r) => inTile(r, t)).length;
          const color =
            count === 0
              ? "#22C55E"
              : ["Expiring", "Shared", "Not approved"].includes(t)
                ? "#F59E0B"
                : "#EF4444";
          const active = tile === t;
          return (
            <button
              key={t}
              onClick={() => {
                setTile((x) => (x === t ? null : t));
                setPage(1);
              }}
              className={cn(
                "flex-1 text-left px-4 py-2.5 transition-colors",
                i > 0 && "border-l border-l-border",
                active ? "bg-row-selected" : "hover:bg-muted/60",
              )}
              style={{ borderLeftColor: color, borderLeftWidth: 3 }}
            >
              <div className="text-[20px] font-bold leading-none" style={{ color }}>
                {count}
                <span className="text-[11px] text-muted-foreground font-normal ml-1">
                  of {rows.length}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap">
                {t === "Expiring" ? `Expiring in ${win} days` : t}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs normal-case tracking-normal">
                    {t === "Expiring"
                      ? `Keys whose next expiry is within ${win} days. Change the window on the right.`
                      : t === "Expired"
                        ? "Keys whose primary key has expired."
                        : `Keys with the ${t} risk.`}
                  </TooltipContent>
                </Tooltip>
              </div>
            </button>
          );
        })}
        <div className="flex items-center gap-1.5 px-3 border-l border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Window</span>
          <Select value={String(win)} onValueChange={(v) => setWin(Number(v))}>
            <SelectTrigger className="h-7 w-[96px] text-[12px]" aria-label="Expiry window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FilterChips
        chips={chips}
        onRemove={(key) => {
          if (key === "tile") setTile(null);
          if (key === "status") setStatusF("All");
          if (key === "mgmt") setMgmtF("All");
        }}
        onClearAll={() => {
          setTile(null);
          setStatusF("All");
          setMgmtF("All");
        }}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-surface border border-border rounded-t-md px-3 py-2">
        <span className="text-[12px] text-muted-foreground">Groups</span>
        <Select value={group} onValueChange={(v) => (setGroup(v), setPage(1))}>
          <SelectTrigger className="h-8 w-[150px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Keys">All Keys</SelectItem>
            {PGP_GROUPS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground ml-1">Status</span>
        <Select value={statusF} onValueChange={(v) => (setStatusF(v), setPage(1))}>
          <SelectTrigger className="h-8 w-[120px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All", "Active", "Expiring", "Expired", "Revoked", ...(own ? ["Retired"] : [])].map(
              (x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground ml-1">
          {own ? "Management" : "Type"}
        </span>
        <Select value={mgmtF} onValueChange={(v) => (setMgmtF(v), setPage(1))}>
          <SelectTrigger className="h-8 w-[130px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(own ? ["All", "Managed", "Discovered"] : ["All", "Partner", "Repository"]).map(
              (x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm ml-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-[13px]"
            placeholder="Search name, email, fingerprint or host"
            value={q}
            onChange={(e) => (setQ(e.target.value), setPage(1))}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={selected.length ? "default" : "outline"}>
                Actions <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {own ? (
                <>
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/inventory/pgp/generate" })}
                    className="font-medium text-primary focus:text-primary"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Generate PGP Key
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {selected.length > 0 && (
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {selected.length} selected
                    </DropdownMenuLabel>
                  )}
                  <ActionItem
                    label="Provision PGP Key"
                    avail={oa("Provision PGP Key")}
                    onSelect={() =>
                      navigate({ to: "/inventory/pgp/provision", search: { key: selOwn[0].id } })
                    }
                  />
                  <ActionItem
                    label="Onboard"
                    avail={oa("Onboard")}
                    onSelect={() => setDlg("onboard")}
                  />
                  <ActionItem
                    label="Extend Expiry"
                    avail={oa("Extend Expiry")}
                    onSelect={() => setDlg("extend")}
                  />
                  <ActionItem
                    label="Rotate Subkey"
                    avail={oa("Rotate Subkey")}
                    onSelect={() => setDlg("rotate")}
                  />
                  <ActionItem
                    label="Revoke"
                    avail={oa("Revoke")}
                    onSelect={() => setDlg("revoke")}
                  />
                  <ActionItem
                    label="Create Revocation Certificate"
                    avail={oa("Create Revocation Certificate")}
                    onSelect={() =>
                      setConfirm({
                        title: "Create Revocation Certificate",
                        body: `Creates a revocation certificate for ${keyName(selOwn[0])} and stores it in ${selOwn[0].storage === "CyberArk" ? "CyberArk" : "AppViewX"}. Use it to revoke the key if the private key is ever lost.`,
                        label: "Create",
                        run: () => createRevCertNow(selOwn[0]),
                      })
                    }
                  />
                  <ActionItem
                    label="Retire"
                    avail={oa("Retire")}
                    onSelect={() => setDlg("retire")}
                  />
                  <ActionItem
                    label="Reactivate"
                    avail={oa("Reactivate")}
                    onSelect={() =>
                      setConfirm({
                        title: `Reactivate ${keyName(selOwn[0])}`,
                        body: "Subkeys ended by Retire become usable again. Subkeys whose expiry has passed will show as Expired. The key is not placed back on hosts it was removed from.",
                        label: "Reactivate",
                        run: () => {
                          reactivate(selOwn[0].id);
                          toast.success(`${keyName(selOwn[0])} reactivated`);
                        },
                      })
                    }
                  />
                  <DropdownMenuSeparator />
                  <ActionItem
                    label="Publish"
                    avail={oa("Publish")}
                    onSelect={() =>
                      setConfirm({
                        title: `Publish ${keyName(selOwn[0])}`,
                        body: `Uploads the public key, including any revocations and new expiry dates, to ${s.settings.keyserver}.`,
                        label: "Publish",
                        run: () => {
                          publishOwn(selOwn[0].id);
                          toast.success(`Published to ${s.settings.keyserver}`);
                        },
                      })
                    }
                  />
                  <ActionItem
                    label="Export for WKD"
                    avail={oa("Export for WKD")}
                    onSelect={() => exportWkd(selOwn[0], s.settings.wkdDomain)}
                  />
                  <ActionItem
                    label="Export Public Key"
                    avail={oa("Export Public Key")}
                    onSelect={() => exportPublic(selOwn)}
                  />
                  <ActionItem
                    label="Download Private Key"
                    avail={oa("Download Private Key")}
                    onSelect={() => setDlg("download")}
                  />
                  <DropdownMenuSeparator />
                  {oa("Delete").ok ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Delete</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => setDeleteMode("From Inventory")}>
                            From Inventory
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteMode("From Hosts")}
                            className="text-risk-red focus:text-risk-red"
                          >
                            From Hosts
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  ) : (
                    <ActionItem label="Delete" avail={oa("Delete")} onSelect={() => undefined} />
                  )}
                </>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={() => setDlg("import")}
                    className="font-medium text-primary focus:text-primary"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Import Key
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {selected.length > 0 && (
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {selected.length} selected
                    </DropdownMenuLabel>
                  )}
                  <ActionItem
                    label="Approve or Reject"
                    avail={ta("Approve or Reject")}
                    onSelect={() => setDlg("decide")}
                  />
                  <ActionItem
                    label="Distribute"
                    avail={ta("Distribute")}
                    onSelect={() => setDlg("distribute")}
                  />
                  <ActionItem
                    label="Replace"
                    avail={ta("Replace")}
                    onSelect={() => setDlg("replace")}
                  />
                  <ActionItem
                    label="Confirm Cutover"
                    avail={ta("Confirm Cutover")}
                    onSelect={() =>
                      setConfirm({
                        title: "Confirm Cutover",
                        body: `The new key is on every location. Removes ${keyName(selTrusted[0])} from ${selTrusted[0].locations.length} location(s) and deletes it from the inventory.`,
                        label: "Confirm Cutover",
                        destructive: true,
                        run: () => {
                          confirmCutover(selTrusted[0].id);
                          setSelected([]);
                          toast.success("Cutover complete. The old key was removed.");
                        },
                      })
                    }
                  />
                  <ActionItem
                    label="Remove from Hosts"
                    avail={ta("Remove from Hosts")}
                    onSelect={() => setDlg("remove")}
                  />
                  <DropdownMenuSeparator />
                  <ActionItem
                    label="Export Public Key"
                    avail={ta("Export Public Key")}
                    onSelect={() => exportPublic(selTrusted)}
                  />
                  <ActionItem
                    label="Delete From Inventory"
                    avail={ta("Delete From Inventory")}
                    className="text-risk-red focus:text-risk-red"
                    onSelect={() =>
                      setConfirm({
                        title: `Delete ${selTrusted.length > 1 ? `${selTrusted.length} keys` : keyName(selTrusted[0])} from inventory`,
                        body: "Removes the key from the AppViewX inventory only. Nothing changes on hosts, so discovery finds it again while it is still on a host.",
                        label: "Delete",
                        destructive: true,
                        run: () => {
                          deleteTrusted(selTrusted.map((k) => k.id));
                          setSelected([]);
                          toast.success("Deleted from inventory");
                        },
                      })
                    }
                  />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setColPicker(true)} title="Columns">
            <Columns className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Refresh"
            onClick={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="inv-frame">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="sl" style={{ left: 0, width: 36, minWidth: 36 }}></th>
                <th className="sl" style={{ left: 36, width: 36, minWidth: 36 }}>
                  <Checkbox
                    checked={paged.length > 0 && paged.every((r) => selected.includes(r.k.id))}
                    onCheckedChange={(v) => setSelected(v ? paged.map((r) => r.k.id) : [])}
                    aria-label="Select all"
                  />
                </th>
                {visibleCols.map((c, i) => (
                  <th
                    key={c.key}
                    className={cn(i === 0 && "sl")}
                    style={i === 0 ? { left: 72, minWidth: 220, maxWidth: 220 } : undefined}
                  >
                    {c.label}
                    {c.mandatory && <span className="text-risk-red ml-0.5">*</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const isSel = selected.includes(r.k.id);
                return (
                  <Fragment key={r.k.id}>
                    <tr className={cn(isSel && "row-selected")} data-key={r.k.id}>
                      <td className="sl" style={{ left: 0, width: 36, minWidth: 36 }}>
                        <button
                          className="p-0.5 hover:bg-muted rounded inline-flex"
                          onClick={() => setExpanded((e) => ({ ...e, [r.k.id]: !e[r.k.id] }))}
                          aria-label="Expand"
                        >
                          {expanded[r.k.id] ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="sl" style={{ left: 36, width: 36, minWidth: 36 }}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={(v) =>
                            setSelected((x) => (v ? [...x, r.k.id] : x.filter((y) => y !== r.k.id)))
                          }
                          aria-label={`Select ${keyName(r.k)}`}
                        />
                      </td>
                      {visibleCols.map((c, i) => (
                        <td
                          key={c.key}
                          className={cn(i === 0 && "sl")}
                          style={i === 0 ? { left: 72, minWidth: 220, maxWidth: 220 } : undefined}
                        >
                          {cell(r, c.key, () => setDrawer(r.k.id))}
                        </td>
                      ))}
                    </tr>
                    {expanded[r.k.id] && (
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
                          <Expanded r={r} onOpen={() => setDrawer(r.k.id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleCols.length + 2}
                    style={{
                      height: "auto",
                      textAlign: "center",
                      padding: 48,
                      maxWidth: "none",
                      color: "var(--color-muted-foreground)",
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
            {filtered.length === 0 ? 0 : (page - 1) * PAGE + 1} to{" "}
            {Math.min(page * PAGE, filtered.length)} of {filtered.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      </div>

      <ColumnPicker
        open={colPicker}
        onClose={() => setColPicker(false)}
        columns={own ? OWN_COLUMNS : TRUSTED_COLUMNS}
        selected={cols}
        onSave={setCols}
      />
      <PgpDetailDrawer keyId={drawer} onClose={() => setDrawer(null)} />

      {own ? (
        <>
          <OnboardDialog k={dlg === "onboard" ? (one as OwnKey) : null} onClose={done} />
          {dlg === "extend" && <ExtendExpiryDialog keys={selOwn} onClose={done} />}
          <RotateSubkeyDialog k={dlg === "rotate" ? (one as OwnKey) : null} onClose={done} />
          <RevokeDialog k={dlg === "revoke" ? (one as OwnKey) : null} onClose={done} />
          <RetireDialog k={dlg === "retire" ? (one as OwnKey) : null} onClose={done} />
          <DownloadPrivateDialog k={dlg === "download" ? (one as OwnKey) : null} onClose={done} />
          <DeleteOwnDialog
            keys={deleteMode ? selOwn : []}
            mode={deleteMode}
            onClose={() => {
              setDeleteMode(null);
              setSelected((x) => x.filter((id) => s.own.some((k) => k.id === id)));
            }}
          />
        </>
      ) : (
        <>
          <ImportKeyDialog
            open={dlg === "import" || dlg === "replace"}
            replacing={dlg === "replace" ? (one as TrustedKey) : null}
            onClose={done}
          />
          <DecideDialog k={dlg === "decide" ? (one as TrustedKey) : null} onClose={done} />
          <DistributeDialog k={dlg === "distribute" ? (one as TrustedKey) : null} onClose={done} />
          <RemoveFromHostsDialog k={dlg === "remove" ? (one as TrustedKey) : null} onClose={done} />
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        description={confirm?.body ?? ""}
        confirmLabel={confirm?.label}
        cancelLabel="Cancel"
        destructive={confirm?.destructive}
        onConfirm={() => {
          confirm?.run();
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function hostsCell(k: PgpKey) {
  if (k.kind === "own") {
    if (k.notProvisioned && !k.privateLocations.length)
      return <span className="text-[12px] text-muted-foreground italic">Not provisioned</span>;
    const n = new Set(k.privateLocations.map((l) => l.host)).size;
    const fail = k.failedLocations.length;
    return (
      <span className="text-[12px]">
        {n} host{n === 1 ? "" : "s"}
        {fail > 0 && <span className="text-risk-red ml-1">({fail} failed)</span>}
      </span>
    );
  }
  const n = new Set(k.locations.map((l) => l.host)).size;
  return (
    <span className="text-[12px]">
      {n ? `${n} host${n === 1 ? "" : "s"}` : <span className="text-muted-foreground">None</span>}
    </span>
  );
}

function cell(r: Row, col: string, open: () => void) {
  const k = r.k;
  const ownK = k.kind === "own" ? k : null;
  const tr = k.kind === "trusted" ? k : null;
  const primaryEmail =
    k.userIds.find((u) => u.primary)?.email ?? k.userIds.find((u) => u.email)?.email;
  switch (col) {
    case "name":
      return (
        <button
          onClick={open}
          className="flex items-center gap-1.5 min-w-0 text-left group"
          title={keyName(k)}
        >
          <KeyRound className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium truncate text-primary group-hover:underline">
            {keyName(k)}
          </span>
          {ownK?.notProvisioned && (
            <Pill className="text-[10px] bg-primary/10 text-primary border-primary/30">New</Pill>
          )}
        </button>
      );
    case "status":
      return <StatusBadge status={r.d.status} />;
    case "purpose":
      return <PurposeList list={r.d.purposes} />;
    case "nextExpiry":
      return <NextExpiryCell k={k} status={r.d.status} />;
    case "algorithm":
      return <span className="text-[12px]">{algoLabel(k.primary.algo)}</span>;
    case "hosts":
      return hostsCell(k);
    case "risk":
      return <RiskList risks={r.d.risks} />;
    case "compliance":
      return r.d.compliance ? <ComplianceCell c={r.d.compliance} /> : null;
    case "management":
      return ownK ? (
        <Pill
          className={
            ownK.management === "Managed" ? "bg-primary/10 text-primary border-primary/30" : ""
          }
        >
          {ownK.management}
        </Pill>
      ) : null;
    case "storage":
      return ownK ? (
        <span className="text-[12px]">
          {ownK.storage === "Host only" ? "Hosts only" : ownK.storage}
        </span>
      ) : null;
    case "keyId":
      return <span className="font-mono text-[11px]">{keyIdOf(k.primary.fingerprint)}</span>;
    case "fingerprint":
      return (
        <span className="font-mono text-[11px]" title={k.primary.fingerprint}>
          {shortFp(k.primary.fingerprint)}
        </span>
      );
    case "email":
      return <span className="text-[12px]">{primaryEmail ?? ""}</span>;
    case "publicCopies":
      return ownK ? <span className="text-[12px]">{ownK.publicCopies.length}</span> : null;
    case "revCert":
      return ownK ? (
        <span className={cn("text-[12px]", ownK.revCert === "Missing" && "text-risk-red")}>
          {ownK.revCert}
        </span>
      ) : null;
    case "publication":
      return ownK ? (
        <span className={cn("text-[12px]", ownK.publication === "Out of date" && "text-[#B45309]")}>
          {ownK.publication}
        </span>
      ) : null;
    case "group":
      return <span className="text-[12px]">{k.group}</span>;
    case "created":
      return <span className="text-[12px]">{fmtDate(k.primary.created)}</span>;
    case "lastDiscovered":
      return (
        <span className="text-[12px]">
          {k.lastDiscovered ? (
            fmtDate(k.lastDiscovered)
          ) : (
            <span className="text-muted-foreground">Not yet</span>
          )}
        </span>
      );
    case "type":
      return tr ? <Pill>{tr.type}</Pill> : null;
    case "approval":
      if (!tr) return null;
      if (tr.type === "Repository")
        return <span className="text-[12px] text-muted-foreground">By policy</span>;
      return (
        <span
          className={cn(
            "text-[12px] font-medium",
            tr.approval === "Approved"
              ? "text-[#15803D]"
              : tr.approval === "Pending"
                ? "text-[#B45309]"
                : "text-risk-red",
          )}
        >
          {tr.approval}
          {tr.decision?.decision === "Not required by policy" && (
            <span className="font-normal text-muted-foreground"> (not required)</span>
          )}
        </span>
      );
    case "source":
      return tr ? <span className="text-[12px]">{tr.source}</span> : null;
    case "imported":
      return tr ? (
        <span className="text-[12px]">
          {tr.imported?.by ?? <span className="text-muted-foreground">Discovery</span>}
        </span>
      ) : null;
  }
  return null;
}

function Expanded({ r, onOpen }: { r: Row; onOpen: () => void }) {
  const k = r.k;
  const locs = k.kind === "own" ? k.privateLocations : k.locations;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-6">
        <KV
          label="Fingerprint"
          value={<span className="font-mono break-all">{k.primary.fingerprint}</span>}
          className="col-span-2"
        />
        <KV
          label="User IDs"
          value={k.userIds.map((u) => `${u.name}${u.email ? ` <${u.email}>` : ""}`).join(", ")}
        />
        <KV
          label="Subkeys"
          value={
            k.subkeys.length
              ? k.subkeys.map((x) => `${x.purpose} (${algoLabel(x.algo)})`).join(", ")
              : "None"
          }
        />
        <KV
          label={k.kind === "own" ? "Private key locations" : "Locations"}
          value={
            locs.length
              ? locs
                  .slice(0, 4)
                  .map((l) => `${l.host} / ${l.osUser}`)
                  .join(", ") + (locs.length > 4 ? ` and ${locs.length - 4} more` : "")
              : "None"
          }
          className="col-span-2"
        />
        {k.kind === "own" && (
          <KV
            label="Revocation certificate"
            value={k.revCert === "Stored" ? `Stored in ${k.revCertWhere}` : "Missing"}
          />
        )}
        {k.kind === "own" && <KV label="Publication" value={k.publication} />}
      </div>
      <button
        onClick={onOpen}
        className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"
      >
        <Download className="h-3 w-3 rotate-[-90deg]" /> Open full details
      </button>
    </div>
  );
}
