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
  Columns3,
  Download,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pager, SortHeader, toolbarButton } from "@/components/common/ListToolbar";
import { toast } from "sonner";
import { HeaderTab, PageHeader } from "@/components/layout/PageHeader";
import { ColumnPicker, type ColumnDef } from "@/components/common/ColumnPicker";
import { FilterChips } from "@/components/common/FilterChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { cn } from "@/lib/utils";
import {
  fmtDate,
  keyIdOf,
  PGP_GROUPS,
  type OwnKey,
  type PgpKey,
  type TrustedKey,
} from "@/data/pgp";
import {
  algoLabel,
  nextExpiryRaw,
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
  { key: "name", label: "Key name", mandatory: true },
  { key: "email", label: "Email" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "purpose", label: "Purpose" },
  { key: "nextExpiry", label: "Next Expiry" },
  { key: "status", label: "Status" },
  { key: "risk", label: "Risk" },
  { key: "compliance", label: "Compliance" },
  { key: "hosts", label: "Hosts" },
  { key: "management", label: "Management" },
  { key: "algorithm", label: "Algorithm" },
  { key: "storage", label: "Storage" },
  { key: "keyId", label: "Key ID" },
  { key: "publicCopies", label: "Public Copies" },
  { key: "revCert", label: "Revocation Certificate" },
  { key: "publication", label: "Publication" },
  { key: "group", label: "Key Group" },
  { key: "created", label: "Created" },
  { key: "lastDiscovered", label: "Last Discovered" },
];
const OWN_DEFAULT = [
  "name",
  "email",
  "fingerprint",
  "purpose",
  "nextExpiry",
  "status",
  "risk",
  "compliance",
  "hosts",
  "management",
];

const TRUSTED_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Key name", mandatory: true },
  { key: "type", label: "Type" },
  { key: "email", label: "Email" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "purpose", label: "Purpose" },
  { key: "nextExpiry", label: "Next Expiry" },
  { key: "status", label: "Status" },
  { key: "approval", label: "Approval" },
  { key: "risk", label: "Risk" },
  { key: "hosts", label: "Hosts" },
  { key: "algorithm", label: "Algorithm" },
  { key: "keyId", label: "Key ID" },
  { key: "source", label: "Source" },
  { key: "group", label: "Key Group" },
  { key: "imported", label: "Imported By" },
  { key: "lastDiscovered", label: "Last Discovered" },
];
const TRUSTED_DEFAULT = [
  "name",
  "type",
  "email",
  "fingerprint",
  "purpose",
  "nextExpiry",
  "status",
  "approval",
  "risk",
  "hosts",
];
const SORTABLE = ["name", "email", "fingerprint", "purpose", "nextExpiry", "status"];

function sortValue(r: Row, col: string): string {
  const k = r.k;
  switch (col) {
    case "name":
      return keyName(k).toLowerCase();
    case "email":
      return (
        k.userIds.find((u) => u.primary)?.email ??
        k.userIds.find((u) => u.email)?.email ??
        ""
      ).toLowerCase();
    case "fingerprint":
      return k.primary.fingerprint.slice(-8);
    case "purpose":
      return r.d.purposes.join(",");
    case "nextExpiry":
      return nextExpiryRaw(k) ?? "9999";
    case "status":
      return r.d.status;
    default:
      return "";
  }
}

const OWN_TILES = ["Expired", "Expiring", "Weak", "Shared", "Rogue", "Misplaced"];
const TRUSTED_TILES = ["Expired", "Expiring", "Not approved", "Untrusted repository"];
const WINDOWS = [7, 30, 60, 90];
const PAGE = 25;

type Row = { k: PgpKey; d: Derived };

export function PgpInventoryPage({
  scope,
  initialTile,
  initialWindow,
  onScope,
}: {
  scope: "own" | "trusted";
  initialTile?: string;
  initialWindow?: number;
  onScope: (s: "own" | "trusted") => void;
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
    `pgp-cols-v2-${scope}`,
    own ? OWN_DEFAULT : TRUSTED_DEFAULT,
  );
  const [colPicker, setColPicker] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
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
  const ordered = sort
    ? [...filtered].sort(
        (a, b) => sortValue(a, sort.col).localeCompare(sortValue(b, sort.col)) * sort.dir,
      )
    : filtered;
  const paged = ordered.slice((page - 1) * PAGE, page * PAGE);
  const toggleSort = (col: string) =>
    setSort((x) => (x && x.col === col ? { col, dir: x.dir === 1 ? -1 : 1 } : { col, dir: 1 }));
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
  const tiles = own ? OWN_TILES : TRUSTED_TILES;
  const tileLabel = (t: string) =>
    t === "Expired"
      ? "Expired Keys"
      : t === "Untrusted repository"
        ? "Untrusted Repository"
        : t === "Not approved"
          ? "Not Approved"
          : `${t} Keys`;

  return (
    <div>
      <PageHeader
        title="PGP Key Inventory"
        tabs={
          <>
            <HeaderTab active={own} onClick={() => onScope("own")}>
              Own Keys
            </HeaderTab>
            <HeaderTab active={!own} onClick={() => onScope("trusted")}>
              Trusted Keys
            </HeaderTab>
          </>
        }
      />

      <div className="page-card">
        {/* Risk tiles */}
        <div
          className="mb-6 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
        >
          {tiles.map((t) => {
            const count = rows.filter((r) => inTile(r, t)).length;
            const color = ["Expiring", "Shared", "Not approved", "Weak"].includes(t)
              ? "#D4A017"
              : "#E5484D";
            const active = tile === t;
            return (
              <div
                key={t}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => {
                  setTile((x) => (x === t ? null : t));
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTile((x) => (x === t ? null : t));
                    setPage(1);
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-md border border-border bg-white px-5 py-4 transition-colors hover:bg-[#F9FAFB]",
                  active && "bg-row-selected ring-1 ring-primary/40",
                )}
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                <div className="flex items-baseline">
                  <span className="text-[30px] font-semibold leading-none text-[#111827]">
                    {count}
                  </span>
                  <span className="ml-0.5 text-[14px] text-[#6B7280]">/{rows.length}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.06em] text-[#374151]">
                  {t === "Expiring" ? (
                    <>
                      Expiring
                      <select
                        aria-label="Expiry window"
                        value={win}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setWin(Number(e.target.value))}
                        className="h-6 rounded border border-[#D1D5DB] bg-white px-0.5 text-[13px] font-medium tracking-normal"
                      >
                        {WINDOWS.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                      days
                    </>
                  ) : (
                    tileLabel(t)
                  )}
                </div>
              </div>
            );
          })}
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
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 overflow-hidden rounded-md border border-[#D1D5DB]">
            <span className="flex items-center border-r border-[#D1D5DB] bg-[#F3F4F6] px-4 text-[15px] font-medium text-[#1F2937]">
              Groups
            </span>
            <div className="relative">
              <select
                aria-label="Groups"
                value={group}
                onChange={(e) => (setGroup(e.target.value), setPage(1))}
                className="h-full w-[176px] appearance-none bg-white pl-3 pr-8 text-[15px] focus:outline-none"
              >
                <option value="All Keys">All Keys</option>
                {PGP_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4B5563]" />
            </div>
          </div>
          <div className="relative min-w-[220px] max-w-[360px] flex-1">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6B7280]" />
            <input
              aria-label="Search keys"
              className="h-10 w-full rounded-md border border-[#D1D5DB] bg-white pl-10 pr-10 text-[15px] placeholder:text-[#9CA3AF] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Type your search and press Enter"
              value={q}
              onChange={(e) => (setQ(e.target.value), setPage(1))}
            />
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filters"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-[#F3F4F6]"
                >
                  <SlidersHorizontal
                    className={cn(
                      "h-[18px] w-[18px]",
                      statusF !== "All" || mgmtF !== "All" ? "text-primary" : "text-[#6B7280]",
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <FilterSelect
                  label="Status"
                  value={statusF}
                  options={[
                    "All",
                    "Active",
                    "Expiring",
                    "Expired",
                    "Revoked",
                    ...(own ? ["Retired"] : []),
                  ]}
                  onChange={(v) => (setStatusF(v), setPage(1))}
                />
                <FilterSelect
                  label={own ? "Management" : "Type"}
                  value={mgmtF}
                  options={
                    own ? ["All", "Managed", "Discovered"] : ["All", "Partner", "Repository"]
                  }
                  onChange={(v) => (setMgmtF(v), setPage(1))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className={cn(toolbarButton, "w-[72px] justify-center px-0")}
              aria-label={own ? "Generate PGP Key" : "Import Key"}
              title={own ? "Generate PGP Key" : "Import Key"}
              onClick={() => (own ? navigate({ to: "/inventory/pgp/generate" }) : setDlg("import"))}
            >
              <Plus className="h-5 w-5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    toolbarButton,
                    "w-[200px] justify-between",
                    selected.length > 0 && "border-primary text-primary",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <LayoutGrid className="h-[18px] w-[18px]" /> Actions
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
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
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
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
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
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
            <button
              type="button"
              aria-label="Columns"
              title="Columns"
              className={cn(toolbarButton, "w-[72px] justify-center px-0")}
              onClick={() => setColPicker(true)}
            >
              <Columns3 className="h-5 w-5" />
            </button>
            <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
          </div>
        </div>

        {/* Table */}
        <div className="inv-frame">
          <div className="inv-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th className="sl" style={{ left: 0, width: 44, minWidth: 44 }}></th>
                  <th className="sl" style={{ left: 44, width: 44, minWidth: 44 }}>
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
                      style={i === 0 ? { left: 88, minWidth: 260, maxWidth: 260 } : undefined}
                    >
                      {SORTABLE.includes(c.key) ? (
                        <SortHeader active={sort?.col === c.key} onClick={() => toggleSort(c.key)}>
                          {c.label}
                        </SortHeader>
                      ) : (
                        c.label
                      )}
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
                        <td className="sl" style={{ left: 0, width: 44, minWidth: 44 }}>
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
                        <td className="sl" style={{ left: 44, width: 44, minWidth: 44 }}>
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={(v) =>
                              setSelected((x) =>
                                v ? [...x, r.k.id] : x.filter((y) => y !== r.k.id),
                              )
                            }
                            aria-label={`Select ${keyName(r.k)}`}
                          />
                        </td>
                        {visibleCols.map((c, i) => (
                          <td
                            key={c.key}
                            className={cn(i === 0 && "sl")}
                            style={i === 0 ? { left: 88, minWidth: 260, maxWidth: 260 } : undefined}
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
      return <span className="text-[14px] text-muted-foreground italic">Not provisioned</span>;
    const n = new Set(k.privateLocations.map((l) => l.host)).size;
    const fail = k.failedLocations.length;
    return (
      <span className="text-[14px]">
        {n} host{n === 1 ? "" : "s"}
        {fail > 0 && <span className="text-risk-red ml-1">({fail} failed)</span>}
      </span>
    );
  }
  const n = new Set(k.locations.map((l) => l.host)).size;
  return (
    <span className="text-[14px]">
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
          className="flex items-center gap-2 min-w-0 text-left group"
          title={keyName(k)}
        >
          <span className="truncate text-[15px] text-primary group-hover:underline">
            {keyName(k)}
          </span>
          {ownK?.notProvisioned && (
            <Pill className="text-[11px] bg-primary/10 text-primary border-primary/30">New</Pill>
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
      return <span className="text-[14px]">{algoLabel(k.primary.algo)}</span>;
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
        <span className="text-[14px]">
          {ownK.storage === "Host only" ? "Hosts only" : ownK.storage}
        </span>
      ) : null;
    case "keyId":
      return <span className="font-mono text-[12px]">{keyIdOf(k.primary.fingerprint)}</span>;
    case "fingerprint":
      return (
        <span className="font-mono text-[14px] text-[#374151]" title={k.primary.fingerprint}>
          … {k.primary.fingerprint.slice(-8, -4)} {k.primary.fingerprint.slice(-4)}
        </span>
      );
    case "email":
      return <span className="text-[14px]">{primaryEmail ?? ""}</span>;
    case "publicCopies":
      return ownK ? <span className="text-[14px]">{ownK.publicCopies.length}</span> : null;
    case "revCert":
      return ownK ? (
        <span className={cn("text-[14px]", ownK.revCert === "Missing" && "text-risk-red")}>
          {ownK.revCert}
        </span>
      ) : null;
    case "publication":
      return ownK ? (
        <span className={cn("text-[14px]", ownK.publication === "Out of date" && "text-[#B45309]")}>
          {ownK.publication}
        </span>
      ) : null;
    case "group":
      return <span className="text-[14px]">{k.group}</span>;
    case "created":
      return <span className="text-[14px]">{fmtDate(k.primary.created)}</span>;
    case "lastDiscovered":
      return (
        <span className="text-[14px]">
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
        return <span className="text-[14px] text-muted-foreground">By policy</span>;
      return (
        <span
          className={cn(
            "text-[14px] font-medium",
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
      return tr ? <span className="text-[14px]">{tr.source}</span> : null;
    case "imported":
      return tr ? (
        <span className="text-[14px]">
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
        className="text-[14px] text-primary hover:underline inline-flex items-center gap-1"
      >
        <Download className="h-3 w-3 rotate-[-90deg]" /> Open full details
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[14px] font-medium text-[#374151]">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-[#D1D5DB] bg-white px-2 text-[14px] focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
