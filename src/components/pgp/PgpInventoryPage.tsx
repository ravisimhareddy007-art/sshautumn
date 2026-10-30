import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Columns3,
  Download,
  FileText,
  Globe,
  KeyRound,
  LayoutGrid,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  ServerOff,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HeaderTab, PageHeader } from "@/components/layout/PageHeader";
import { ColumnPicker, type ColumnDef } from "@/components/common/ColumnPicker";
import { FilterChips } from "@/components/common/FilterChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Pager, SortHeader, toolbarButton } from "@/components/common/ListToolbar";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { cn } from "@/lib/utils";
import { fmtDate, keyIdOf, PGP_GROUPS, type OwnKey, type PgpKey, type TrustedKey } from "@/data/pgp";
import { algoLabel, nextExpiryRaw, ownActionAvailability, trustedActionAvailability, withinWindow, type OwnAction, type TrustedAction } from "@/lib/pgp-rules";
import { confirmCutover, deleteTrusted, keyName, publishOwn, reactivate, thresholdFor, usePgp } from "@/lib/pgp-store";
import {
  ActionItem,
  ComplianceCell,
  derive,
  DotPill,
  HostCount,
  ManagementPill,
  MenuGroupLabel,
  NextExpiryCell,
  Pill,
  PurposeList,
  RiskList,
  StatusBadge,
  StorageCell,
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

type Col = ColumnDef & { width: number };

const OWN_COLUMNS: Col[] = [
  { key: "name", label: "Key name", mandatory: true, width: 210 },
  { key: "email", label: "Email", width: 210 },
  { key: "fingerprint", label: "Fingerprint", width: 112 },
  { key: "purpose", label: "Purpose", width: 172 },
  { key: "nextExpiry", label: "Next Expiry", width: 116 },
  { key: "status", label: "Status", width: 100 },
  { key: "hosts", label: "Hosts", width: 78 },
  { key: "owner", label: "Owner", width: 92 },
  { key: "management", label: "Management", width: 122 },
  { key: "storage", label: "Storage", width: 110 },
  { key: "risk", label: "Risk", width: 168 },
  { key: "compliance", label: "Compliance", width: 140 },
  { key: "algorithm", label: "Algorithm", width: 100 },
  { key: "keyId", label: "Key ID", width: 150 },
  { key: "publicCopies", label: "Public Copies", width: 110 },
  { key: "revCert", label: "Revocation Certificate", width: 170 },
  { key: "publication", label: "Publication", width: 130 },
  { key: "group", label: "Key Group", width: 150 },
  { key: "created", label: "Created", width: 110 },
  { key: "lastDiscovered", label: "Last Discovered", width: 130 },
];
const OWN_DEFAULT = ["name", "email", "fingerprint", "purpose", "nextExpiry", "status", "hosts", "owner", "management", "storage", "risk", "compliance"];

const TRUSTED_COLUMNS: Col[] = [
  { key: "name", label: "Key name", mandatory: true, width: 210 },
  { key: "type", label: "Type", width: 100 },
  { key: "email", label: "Email", width: 210 },
  { key: "fingerprint", label: "Fingerprint", width: 112 },
  { key: "purpose", label: "Purpose", width: 150 },
  { key: "nextExpiry", label: "Next Expiry", width: 116 },
  { key: "status", label: "Status", width: 100 },
  { key: "hosts", label: "Hosts", width: 78 },
  { key: "approval", label: "Approval", width: 120 },
  { key: "risk", label: "Risk", width: 170 },
  { key: "algorithm", label: "Algorithm", width: 100 },
  { key: "keyId", label: "Key ID", width: 150 },
  { key: "source", label: "Source", width: 130 },
  { key: "group", label: "Key Group", width: 150 },
  { key: "imported", label: "Imported By", width: 120 },
  { key: "lastDiscovered", label: "Last Discovered", width: 130 },
];
const TRUSTED_DEFAULT = ["name", "type", "email", "fingerprint", "purpose", "nextExpiry", "status", "hosts", "approval", "risk"];

const OWN_TILES = ["Shared", "Weak", "Misplaced", "Rogue"];
const TRUSTED_TILES = ["Not approved", "Weak", "Revoked but present", "Untrusted repository"];
const TILE_LABEL: Record<string, string> = {
  Shared: "Shared Keys",
  Weak: "Weak Keys",
  Misplaced: "Misplaced Keys",
  Rogue: "Rogue Keys",
  "Not approved": "Not Approved Keys",
  "Revoked but present": "Revoked Keys on Hosts",
  "Untrusted repository": "Untrusted Repository Keys",
  Expired: "Expired Keys",
};
const AMBER_TILES = ["Shared", "Weak", "Not approved"];
const WINDOWS = [7, 30, 60, 90];
const PAGE = 25;

type Row = { k: PgpKey; d: Derived };

const hostsOf = (k: PgpKey) => new Set((k.kind === "own" ? k.privateLocations : k.locations).map((l) => l.host)).size;
const ownerOf = (k: PgpKey) => (k.kind === "own" ? (k.privateLocations[0]?.osUser ?? "") : "");
const emailOf = (k: PgpKey) => k.userIds.find((u) => u.primary)?.email ?? k.userIds.find((u) => u.email)?.email ?? "";

function sortValue(r: Row, col: string): string {
  const k = r.k;
  const own = k.kind === "own" ? k : null;
  const tr = k.kind === "trusted" ? k : null;
  switch (col) {
    case "name":
      return keyName(k).toLowerCase();
    case "email":
      return emailOf(k).toLowerCase();
    case "fingerprint":
      return k.primary.fingerprint.slice(-8);
    case "purpose":
      return r.d.purposes.join(",");
    case "nextExpiry":
      return nextExpiryRaw(k) ?? "9999";
    case "status":
      return r.d.status;
    case "hosts":
      return String(hostsOf(k)).padStart(4, "0");
    case "owner":
      return ownerOf(k);
    case "management":
      return own?.management ?? "";
    case "storage":
      return own?.storage ?? "";
    case "risk":
      return String(9 - r.d.risks.length) + r.d.risks.join(",");
    case "compliance":
      return r.d.compliance?.state ?? "";
    case "type":
      return tr?.type ?? "";
    case "approval":
      return tr?.approval ?? "";
    case "algorithm":
      return algoLabel(k.primary.algo);
    case "created":
      return k.primary.created;
    default:
      return "";
  }
}

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
  const [tile, setTile] = useState<string | null>(initialTile ?? null);
  const [win, setWin] = useState(30);
  useEffect(() => {
    if (initialWindow && WINDOWS.includes(initialWindow)) setWin(initialWindow);
  }, [initialWindow]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cols, setCols] = usePersistedState<string[]>(`pgp-cols-v3-${scope}`, own ? OWN_DEFAULT : TRUSTED_DEFAULT);
  const [colPicker, setColPicker] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; run: () => void; destructive?: boolean } | null>(null);

  const all: PgpKey[] = own ? s.own : s.trusted;
  const rows: Row[] = useMemo(() => all.map((k) => ({ k, d: derive(k, s.policies) })), [all, s.policies]);
  const inTile = (r: Row, t: string) => (t === "Expiring" ? withinWindow(r.k, r.d.status, win) : t === "Expired" ? r.d.status === "Expired" : r.d.risks.includes(t));

  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (group !== "All Keys" && r.k.group !== group) return false;
    if (statusF !== "All" && r.d.status !== statusF) return false;
    if (mgmtF !== "All" && (own ? (r.k as OwnKey).management : (r.k as TrustedKey).type) !== mgmtF) return false;
    if (tile && !inTile(r, tile)) return false;
    if (needle) {
      const locs = r.k.kind === "own" ? r.k.privateLocations : r.k.locations;
      const hay = [keyName(r.k), r.k.primary.fingerprint, ...r.k.userIds.map((u) => `${u.name} ${u.email ?? ""}`), ...locs.map((l) => `${l.host} ${l.osUser}`)].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const ordered = sort ? [...filtered].sort((a, b) => sortValue(a, sort.col).localeCompare(sortValue(b, sort.col)) * sort.dir) : filtered;
  const paged = ordered.slice((page - 1) * PAGE, page * PAGE);
  const allCols = own ? OWN_COLUMNS : TRUSTED_COLUMNS;
  const visibleCols = allCols.filter((c) => c.mandatory || cols.includes(c.key));
  const toggleSort = (col: string) => setSort((x) => (x && x.col === col ? { col, dir: x.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const selOwn = s.own.filter((k) => selected.includes(k.id));
  const selTrusted = s.trusted.filter((k) => selected.includes(k.id));
  const one = own ? selOwn[0] : selTrusted[0];
  const oa = (a: OwnAction) => ownActionAvailability(a, selOwn, { keyserver: s.settings.keyserver || null, threshold: (k: OwnKey) => thresholdFor(k) });
  const ta = (a: TrustedAction) => trustedActionAvailability(a, selTrusted, { currentUser: "admin", threshold: (k) => thresholdFor(k), all: s.trusted });

  const chips = [
    ...(tile ? [{ key: "tile", label: `Risk: ${tile === "Expiring" ? `Expiring in ${win} days` : tile}` }] : []),
    ...(statusF !== "All" ? [{ key: "status", label: `Status: ${statusF}` }] : []),
    ...(mgmtF !== "All" ? [{ key: "mgmt", label: `${own ? "Management" : "Type"}: ${mgmtF}` }] : []),
  ];
  const done = () => setDlg(null);
  const tiles = own ? OWN_TILES : TRUSTED_TILES;
  const clearGone = () => setSelected((x) => x.filter((id) => s.own.some((k) => k.id === id) || s.trusted.some((k) => k.id === id)));

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
        <div className="mb-[26px] grid grid-cols-4 gap-2.5">
          {tiles.map((t) => {
            const count = rows.filter((r) => inTile(r, t)).length;
            const active = tile === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTile((x) => (x === t ? null : t));
                  setPage(1);
                }}
                className={cn("rounded-[4px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-left transition-colors hover:bg-[#F9FAFB]", active && "bg-row-selected ring-1 ring-primary/40")}
                style={{ borderLeftWidth: 3, borderLeftColor: AMBER_TILES.includes(t) ? "#C9A227" : "#DC2626" }}
              >
                <div className="flex items-baseline">
                  <span className="text-[24px] font-semibold leading-none text-[#111827]">{count}</span>
                  <span className="text-[12px] text-[#6B7280]">/{rows.length}</span>
                </div>
                <div className="mt-2 text-[11.5px] font-medium uppercase tracking-[0.1em] text-[#374151]">{TILE_LABEL[t]}</div>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="mb-5 border-b border-[#EDEFF3] px-[15px] pb-3.5">
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 overflow-hidden rounded-md border border-[#D1D5DB]">
              <span className="flex w-[72px] items-center justify-center border-r border-[#D1D5DB] bg-[#F3F4F6] text-[13.5px] font-medium text-[#1F2937]">Groups</span>
              <div className="relative">
                <select
                  aria-label="Groups"
                  value={group}
                  onChange={(e) => (setGroup(e.target.value), setPage(1))}
                  className="h-full w-[108px] appearance-none bg-white pl-2.5 pr-7 text-[13.5px] focus:outline-none"
                >
                  <option value="All Keys">All Keys</option>
                  {PGP_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4B5563]" />
              </div>
            </div>
            <div className="relative w-[384px] min-w-[200px] shrink">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                aria-label="Search keys"
                className="h-8 w-full rounded-md border border-[#D1D5DB] bg-white pl-9 pr-3 text-[13.5px] placeholder:text-[#9CA3AF] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Type your search and press enter"
                value={q}
                onChange={(e) => (setQ(e.target.value), setPage(1))}
              />
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Filters" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#F3F4F6]">
                    <SlidersHorizontal className={cn("h-4 w-4", statusF !== "All" || mgmtF !== "All" ? "text-primary" : "text-[#6B7280]")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 space-y-3">
                  <FilterSelect label="Status" value={statusF} options={["All", "Active", "Expiring", "Expired", "Revoked", ...(own ? ["Retired"] : [])]} onChange={(v) => (setStatusF(v), setPage(1))} />
                  <FilterSelect
                    label={own ? "Management" : "Type"}
                    value={mgmtF}
                    options={own ? ["All", "Managed", "Discovered"] : ["All", "Partner", "Repository"]}
                    onChange={(v) => (setMgmtF(v), setPage(1))}
                  />
                </PopoverContent>
              </Popover>
              <button
                type="button"
                className={cn(toolbarButton, "w-[50px] justify-center px-0")}
                aria-label={own ? "Generate PGP Key" : "Import Key"}
                title={own ? "Generate PGP Key" : "Import Key"}
                onClick={() => (own ? navigate({ to: "/inventory/pgp/generate" }) : setDlg("import"))}
              >
                <Plus className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={cn(toolbarButton, "w-[134px] justify-between")}>
                    <span className="inline-flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" /> Actions
                    </span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[288px] p-0 py-1">
                  {own ? (
                    <>
                      <MenuGroupLabel>Deploy and keep current</MenuGroupLabel>
                      <ActionItem icon={<KeyRound className="h-4 w-4" />} label="Provision PGP Key" avail={oa("Provision PGP Key")} onSelect={() => navigate({ to: "/inventory/pgp/provision", search: { key: selOwn[0].id } })} />
                      <ActionItem icon={<CalendarDays className="h-4 w-4" />} label="Extend Expiry" avail={oa("Extend Expiry")} onSelect={() => setDlg("extend")} />
                      <ActionItem icon={<RotateCw className="h-4 w-4" />} label="Rotate Subkey" avail={oa("Rotate Subkey")} onSelect={() => setDlg("rotate")} />
                      <Divider />
                      <MenuGroupLabel>Take out of use</MenuGroupLabel>
                      <ActionItem icon={<CircleCheck className="h-4 w-4" />} label="Onboard" avail={oa("Onboard")} onSelect={() => setDlg("onboard")} />
                      <ActionItem icon={<Ban className="h-4 w-4" />} label="Revoke" avail={oa("Revoke")} onSelect={() => setDlg("revoke")} />
                      <ActionItem
                        icon={<FileText className="h-4 w-4" />}
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
                      <ActionItem icon={<Clock className="h-4 w-4" />} label="Retire" avail={oa("Retire")} onSelect={() => setDlg("retire")} />
                      <ActionItem
                        icon={<RotateCcw className="h-4 w-4" />}
                        label="Reactivate"
                        avail={oa("Reactivate")}
                        onSelect={() =>
                          setConfirm({
                            title: `Reactivate ${keyName(selOwn[0])}`,
                            body: "Subkeys ended by Retire become usable again. Subkeys whose expiry has passed show as Expired. The key is not placed back on hosts it was removed from.",
                            label: "Reactivate",
                            run: () => {
                              reactivate(selOwn[0].id);
                              toast.success(`${keyName(selOwn[0])} reactivated`);
                            },
                          })
                        }
                      />
                      <ActionItem icon={<Trash2 className="h-4 w-4" />} label="Delete" avail={oa("Delete")} onSelect={() => setDlg("delete")} />
                      <Divider />
                      <MenuGroupLabel>Share</MenuGroupLabel>
                      <ActionItem
                        icon={<Globe className="h-4 w-4" />}
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
                      <ActionItem icon={<Upload className="h-4 w-4" />} label="Export Public Key" avail={oa("Export Public Key")} onSelect={() => exportPublic(selOwn)} />
                      <ActionItem icon={<Upload className="h-4 w-4" />} label="Export for WKD" avail={oa("Export for WKD")} onSelect={() => exportWkd(selOwn[0], s.settings.wkdDomain)} />
                      <ActionItem icon={<Download className="h-4 w-4" />} label="Download Private Key" avail={oa("Download Private Key")} onSelect={() => setDlg("download")} />
                    </>
                  ) : (
                    <>
                      <MenuGroupLabel>Add and approve</MenuGroupLabel>
                      <ActionItem icon={<Plus className="h-4 w-4" />} label="Import Key" avail={{ ok: true }} onSelect={() => setDlg("import")} />
                      <ActionItem icon={<ShieldCheck className="h-4 w-4" />} label="Approve or Reject" avail={ta("Approve or Reject")} onSelect={() => setDlg("decide")} />
                      <Divider />
                      <MenuGroupLabel>Deploy</MenuGroupLabel>
                      <ActionItem icon={<Send className="h-4 w-4" />} label="Distribute" avail={ta("Distribute")} onSelect={() => setDlg("distribute")} />
                      <ActionItem icon={<Repeat className="h-4 w-4" />} label="Replace" avail={ta("Replace")} onSelect={() => setDlg("replace")} />
                      <ActionItem
                        icon={<CheckCheck className="h-4 w-4" />}
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
                      <Divider />
                      <MenuGroupLabel>Take out of use</MenuGroupLabel>
                      <ActionItem icon={<ServerOff className="h-4 w-4" />} label="Remove from Hosts" avail={ta("Remove from Hosts")} onSelect={() => setDlg("remove")} />
                      <ActionItem
                        icon={<Trash2 className="h-4 w-4" />}
                        label="Delete From Inventory"
                        avail={ta("Delete From Inventory")}
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
                      <Divider />
                      <MenuGroupLabel>Share</MenuGroupLabel>
                      <ActionItem icon={<Upload className="h-4 w-4" />} label="Export Public Key" avail={ta("Export Public Key")} onSelect={() => exportPublic(selTrusted)} />
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" aria-label="Columns" title="Columns" className={cn(toolbarButton, "w-[50px] justify-center px-0")} onClick={() => setColPicker(true)}>
                <Columns3 className="h-4 w-4" />
              </button>
              <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="inv-frame">
          <div className="inv-scroll">
            <table className="inv-table" style={{ minWidth: 76 + visibleCols.reduce((n, c) => n + c.width, 0) }}>
              <thead>
                <tr>
                  <th style={{ width: 42, minWidth: 42 }} />
                  <th style={{ width: 34, minWidth: 34, paddingLeft: 0 }}>
                    <Checkbox aria-label="Select all" checked={paged.length > 0 && paged.every((r) => selected.includes(r.k.id))} onCheckedChange={(v) => setSelected(v ? paged.map((r) => r.k.id) : [])} />
                  </th>
                  {visibleCols.map((c) => (
                    <th key={c.key} style={{ minWidth: c.width, width: c.width }}>
                      <SortHeader active={sort?.col === c.key} onClick={() => toggleSort(c.key)}>
                        {c.label}
                      </SortHeader>
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
                        <td style={{ textAlign: "center" }}>
                          <button className="inline-flex rounded p-0.5 text-[#4B5563] hover:bg-muted" onClick={() => setExpanded((e) => ({ ...e, [r.k.id]: !e[r.k.id] }))} aria-label="Expand">
                            {expanded[r.k.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td style={{ paddingLeft: 0 }}>
                          <Checkbox checked={isSel} onCheckedChange={(v) => setSelected((x) => (v ? [...x, r.k.id] : x.filter((y) => y !== r.k.id)))} aria-label={`Select ${keyName(r.k)}`} />
                        </td>
                        {visibleCols.map((c) => (
                          <td key={c.key}>{cell(r, c.key, () => setDrawer(r.k.id))}</td>
                        ))}
                      </tr>
                      {expanded[r.k.id] && (
                        <tr>
                          <td colSpan={visibleCols.length + 2} style={{ height: "auto", whiteSpace: "normal", overflow: "visible", maxWidth: "none", background: "#F9FAFB", padding: "12px 16px 14px 88px" }}>
                            <Expanded r={r} onOpen={() => setDrawer(r.k.id)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 2} style={{ height: 110, textAlign: "center", maxWidth: "none", color: "#6B7280" }}>
                      No keys match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ColumnPicker open={colPicker} onClose={() => setColPicker(false)} columns={allCols} selected={cols} onSave={setCols} />
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
            keys={selOwn}
            open={dlg === "delete"}
            onClose={() => {
              done();
              clearGone();
            }}
          />
        </>
      ) : (
        <>
          <ImportKeyDialog open={dlg === "import" || dlg === "replace"} replacing={dlg === "replace" ? (one as TrustedKey) : null} onClose={done} />
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

function Divider() {
  return <div className="my-1 h-px bg-[#EDEFF3]" />;
}

function cell(r: Row, col: string, open: () => void): ReactNode {
  const k = r.k;
  const ownK = k.kind === "own" ? k : null;
  const tr = k.kind === "trusted" ? k : null;
  switch (col) {
    case "name":
      return (
        <button onClick={open} className="max-w-full truncate text-left text-[13.5px] text-primary hover:underline" title={keyName(k)}>
          {keyName(k)}
        </button>
      );
    case "email":
      return <span title={emailOf(k)}>{emailOf(k) || <span className="text-[#9CA3AF]">—</span>}</span>;
    case "fingerprint":
      return (
        <span className="font-mono text-[11.5px] text-[#374151]" title={k.primary.fingerprint}>
          … {k.primary.fingerprint.slice(-8, -4)} {k.primary.fingerprint.slice(-4)}
        </span>
      );
    case "purpose":
      return <PurposeList list={r.d.purposes} />;
    case "nextExpiry":
      return <NextExpiryCell k={k} status={r.d.status} />;
    case "status":
      return <StatusBadge status={r.d.status} />;
    case "hosts":
      return <HostCount n={hostsOf(k)} />;
    case "owner":
      return ownerOf(k) || <span className="text-[#6B7280]">—</span>;
    case "management":
      return ownK ? <ManagementPill k={ownK} /> : null;
    case "storage":
      return ownK ? <StorageCell storage={ownK.storage} /> : null;
    case "risk":
      return <RiskList risks={r.d.risks} />;
    case "compliance":
      return r.d.compliance ? <ComplianceCell c={r.d.compliance} /> : null;
    case "algorithm":
      return algoLabel(k.primary.algo);
    case "keyId":
      return <span className="font-mono text-[11.5px]">{keyIdOf(k.primary.fingerprint)}</span>;
    case "publicCopies":
      return ownK ? <HostCount n={ownK.publicCopies.length} /> : null;
    case "revCert":
      return ownK ? <DotPill tone={ownK.revCert === "Stored" ? "green" : "red"}>{ownK.revCert}</DotPill> : null;
    case "publication":
      return ownK ? <DotPill tone={ownK.publication === "Published" ? "green" : ownK.publication === "Out of date" ? "amber" : "grey"}>{ownK.publication}</DotPill> : null;
    case "group":
      return k.group;
    case "created":
      return fmtDate(k.primary.created);
    case "lastDiscovered":
      return k.lastDiscovered ? fmtDate(k.lastDiscovered) : <span className="text-[#6B7280]">Not yet</span>;
    case "type":
      return tr ? <Pill>{tr.type}</Pill> : null;
    case "approval":
      if (!tr) return null;
      if (tr.type === "Repository") return <span className="text-[#6B7280]">By policy</span>;
      return (
        <DotPill tone={tr.approval === "Approved" ? "green" : tr.approval === "Pending" ? "amber" : "red"} title={tr.decision?.decision === "Not required by policy" ? "Approval not required by policy" : undefined}>
          {tr.approval}
        </DotPill>
      );
    case "source":
      return tr?.source ?? null;
    case "imported":
      return tr ? (tr.imported?.by ?? <span className="text-[#6B7280]">Discovery</span>) : null;
  }
  return null;
}

function Expanded({ r, onOpen }: { r: Row; onOpen: () => void }) {
  const k = r.k;
  const locs = k.kind === "own" ? k.privateLocations : k.locations;
  const item = (label: string, value: ReactNode, wide?: boolean) => (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-[12px] text-[#6B7280]">{label}</div>
      <div className="mt-0.5 break-words text-[13px] text-[#111827]">{value}</div>
    </div>
  );
  return (
    <div>
      <div className="grid grid-cols-4 gap-x-8 gap-y-3">
        {item("Fingerprint", <span className="font-mono text-[12px]">{k.primary.fingerprint}</span>, true)}
        {item("User IDs", k.userIds.map((u) => `${u.name}${u.email ? ` <${u.email}>` : ""}`).join(", "))}
        {item("Subkeys", k.subkeys.length ? k.subkeys.map((x) => `${x.purpose} (${algoLabel(x.algo)})`).join(", ") : "None")}
        {item(
          k.kind === "own" ? "Private key locations" : "Locations",
          locs.length ? locs.slice(0, 4).map((l) => `${l.host} / ${l.osUser}`).join(", ") + (locs.length > 4 ? ` and ${locs.length - 4} more` : "") : "None",
          true,
        )}
        {k.kind === "own" && item("Revocation certificate", k.revCert === "Stored" ? `Stored in ${k.revCertWhere}` : "Missing")}
        {k.kind === "own" && item("Publication", k.publication)}
      </div>
      <button onClick={onOpen} className="mt-3 text-[13px] text-primary hover:underline">
        Open full details
      </button>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-[#374151]">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-full rounded-md border border-[#D1D5DB] bg-white px-2 text-[13px] focus:border-primary focus:outline-none">
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
