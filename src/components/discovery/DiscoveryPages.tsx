import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Pager,
  SearchBox,
  SortHeader,
  toolbarButton,
  useSort,
} from "@/components/common/ListToolbar";
import { PillSwitch } from "@/components/common/ProductForm";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HOSTS, type Host } from "@/data/mock";
import type { DiscoveryRun, DiscoverySchedule } from "@/data/discovery";
import { deleteSchedules, runScheduleNow, setScheduleEnabled, usePgp } from "@/lib/pgp-store";
import { cn } from "@/lib/utils";

const PAGE = 10;

function ActionsButton({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            toolbarButton,
            "w-[168px] justify-between",
            active && "border-primary text-primary",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <LayoutGrid className="h-[18px] w-[18px]" /> Actions
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td
        colSpan={cols}
        style={{ height: 120, textAlign: "center", maxWidth: "none", color: "#6B7280" }}
      >
        {text}
      </td>
    </tr>
  );
}

const STATUS_STYLE: Record<DiscoveryRun["status"], string> = {
  Running: "border-primary/30 bg-primary/10 text-primary",
  Completed: "border-risk-green/30 bg-risk-green/10 text-[#15803D]",
  Failed: "border-risk-red/30 bg-risk-red/10 text-risk-red",
};

// ─── Discovery Status ──────────────────────────────────────────────────────────

export function DiscoveryStatusPage() {
  const s = usePgp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = s.runs.filter((r) =>
    `${r.name} ${r.range} ${r.by}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort<DiscoveryRun>(rows);
  const total = (k: "userKeys" | "hostKeys" | "pgpKeys") =>
    s.runs.filter((r) => r.status === "Completed").reduce((n, r) => n + r[k], 0);

  return (
    <div>
      <PageHeader title="Discovery Status" />
      <div className="page-card">
        <div className="mb-6 grid grid-cols-4 gap-4">
          <Stat label="Discovery Runs" value={s.runs.length} />
          <Stat label="User Keys Found" value={total("userKeys")} />
          <Stat label="Host Keys Found" value={total("hostKeys")} />
          <Stat label="PGP Keys Found" value={total("pgpKeys")} />
        </div>
        <div className="mb-5 flex items-center gap-3">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setPage(1))}
            placeholder="Type your search and press Enter"
            className="w-[420px]"
          />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className={toolbarButton}
              onClick={() => navigate({ to: "/discovery/network-scan" })}
            >
              <Plus className="h-[18px] w-[18px]" /> New Network Scan
            </button>
            <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </div>
        </div>
        <div className="inv-frame">
          <div className="inv-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>
                    <SortHeader onClick={() => by("name", (r) => r.name.toLowerCase())}>
                      Discovery name
                    </SortHeader>
                  </th>
                  <th>IP range</th>
                  <th>
                    <SortHeader onClick={() => by("startedAt", (r) => r.startedAt)}>
                      Started
                    </SortHeader>
                  </th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Hosts reached</th>
                  <th>User keys</th>
                  <th>Host keys</th>
                  <th>PGP keys</th>
                  <th>Started by</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="font-mono text-[13px]">{r.range}</td>
                    <td>{r.startedAt}</td>
                    <td>{r.mode}</td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[13px] font-medium",
                          STATUS_STYLE[r.status],
                        )}
                      >
                        {r.status === "Running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === "Running" ? "…" : `${r.hostsReached} of ${r.hostsScanned}`}
                    </td>
                    <td>
                      {r.discover.includes("User Keys")
                        ? r.status === "Running"
                          ? "…"
                          : r.userKeys
                        : "Not scanned"}
                    </td>
                    <td>
                      {r.discover.includes("Host Keys")
                        ? r.status === "Running"
                          ? "…"
                          : r.hostKeys
                        : "Not scanned"}
                    </td>
                    <td>
                      {r.discover.includes("PGP Keys")
                        ? r.status === "Running"
                          ? "…"
                          : r.pgpKeys
                        : "Not scanned"}
                    </td>
                    <td>{r.by}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <Empty cols={10} text="No discovery runs match your search." />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md border border-border px-5 py-4"
      style={{ borderLeftColor: "#6B5FD6", borderLeftWidth: 3 }}
    >
      <div className="text-[30px] font-semibold leading-none text-[#111827]">{value}</div>
      <div className="mt-2.5 text-[13px] font-medium uppercase tracking-[0.08em] text-[#374151]">
        {label}
      </div>
    </div>
  );
}

// ─── Scheduler ─────────────────────────────────────────────────────────────────

export function SchedulerPage() {
  const s = usePgp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const rows = s.schedules.filter((r) =>
    `${r.name} ${r.range}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort<DiscoverySchedule>(rows);
  const paged = sorted.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div>
      <PageHeader title="Scheduler" />
      <div className="page-card">
        <div className="mb-5 flex items-center gap-3">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setPage(1))}
            placeholder="Type your search and press Enter"
            className="w-[420px]"
          />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className={toolbarButton}
              onClick={() => navigate({ to: "/discovery/network-scan" })}
            >
              <Plus className="h-[18px] w-[18px]" /> Schedule Discovery
            </button>
            <ActionsButton active={selected.length > 0}>
              <DropdownMenuItem
                disabled={selected.length !== 1}
                onClick={() => {
                  runScheduleNow(selected[0]);
                  toast.success("Discovery started. See Discovery Status.");
                }}
              >
                Run Now
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!selected.length}
                className="text-risk-red focus:text-risk-red"
                onClick={() => setConfirm(true)}
              >
                Delete
              </DropdownMenuItem>
            </ActionsButton>
            <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </div>
        </div>
        <div className="inv-frame">
          <div className="inv-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>
                    <Checkbox
                      aria-label="Select all"
                      checked={paged.length > 0 && paged.every((r) => selected.includes(r.id))}
                      onCheckedChange={(v) => setSelected(v ? paged.map((r) => r.id) : [])}
                    />
                  </th>
                  <th>
                    <SortHeader onClick={() => by("name", (r) => r.name.toLowerCase())}>
                      Discovery name
                    </SortHeader>
                  </th>
                  <th>IP range</th>
                  <th>Frequency</th>
                  <th>
                    <SortHeader onClick={() => by("nextRun", (r) => r.nextRun)}>
                      Next run
                    </SortHeader>
                  </th>
                  <th>Discovers</th>
                  <th>Created by</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className={cn(selected.includes(r.id) && "row-selected")}>
                    <td>
                      <Checkbox
                        aria-label={`Select ${r.name}`}
                        checked={selected.includes(r.id)}
                        onCheckedChange={(v) =>
                          setSelected((x) => (v ? [...x, r.id] : x.filter((y) => y !== r.id)))
                        }
                      />
                    </td>
                    <td className="font-medium">{r.name}</td>
                    <td className="font-mono text-[13px]">{r.range}</td>
                    <td>
                      {r.frequency} at {r.time}
                    </td>
                    <td>{r.enabled ? r.nextRun : "Paused"}</td>
                    <td>{r.discover.join(", ")}</td>
                    <td>{r.by}</td>
                    <td>
                      <div className="-mt-2">
                        <PillSwitch
                          value={r.enabled}
                          label={`Enable ${r.name}`}
                          onChange={(v) => {
                            setScheduleEnabled(r.id, v);
                            toast.success(v ? `"${r.name}" resumed` : `"${r.name}" paused`);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <Empty cols={8} text="No scheduled discoveries." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Delete ${selected.length} schedule${selected.length > 1 ? "s" : ""}`}
        description="Scheduled discoveries stop running. Past results stay in Discovery Status."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          deleteSchedules(selected);
          setSelected([]);
          setConfirm(false);
          toast.success("Schedule deleted");
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

// ─── Managed Devices ───────────────────────────────────────────────────────────

export function ManagedDevicesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = HOSTS.filter((h) =>
    `${h.deviceName} ${h.hostName} ${h.group}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort<Host>(rows);

  return (
    <div>
      <PageHeader title="Managed Devices" />
      <div className="page-card">
        <div className="mb-5 flex items-center gap-3">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setPage(1))}
            placeholder="Type your search and press Enter"
            className="w-[420px]"
          />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className={toolbarButton}
              onClick={() => navigate({ to: "/discovery/network-scan" })}
            >
              <Plus className="h-[18px] w-[18px]" /> Add Devices
            </button>
            <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </div>
        </div>
        <div className="inv-frame">
          <div className="inv-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>
                    <SortHeader onClick={() => by("device", (h) => h.deviceName)}>
                      Device name
                    </SortHeader>
                  </th>
                  <th>
                    <SortHeader onClick={() => by("host", (h) => h.hostName.toLowerCase())}>
                      Host name
                    </SortHeader>
                  </th>
                  <th>Host Compliance Group</th>
                  <th>Status</th>
                  <th>Access</th>
                  <th>OpenSSH</th>
                  <th>Last sync</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice((page - 1) * PAGE, page * PAGE).map((h) => (
                  <tr key={h.id}>
                    <td className="font-mono text-[13px]">{h.deviceName}</td>
                    <td>{h.hostName}</td>
                    <td>{h.group}</td>
                    <td>
                      <span
                        className={cn(
                          "rounded border px-2 py-0.5 text-[13px] font-medium",
                          h.hostStatus === "Managed"
                            ? "border-risk-green/30 bg-risk-green/10 text-[#15803D]"
                            : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {h.hostStatus}
                      </span>
                    </td>
                    <td>
                      {h.accessType} : {h.port}
                    </td>
                    <td>{h.openSshVersion ?? "Unknown"}</td>
                    <td>{h.lastSyncTime}</td>
                  </tr>
                ))}
                {rows.length === 0 && <Empty cols={7} text="No devices match your search." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
