import { Fragment, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Radar,
  Shield,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pager, SearchBox, SortHeader, useSort } from "@/components/common/ListToolbar";
import { HOST_KEYS, HOSTS, USER_KEYS } from "@/data/mock";
import { HOST_GROUPS, type HostGroup, type InfraAccessGroup } from "@/data/discovery";
import { KEY_GROUPS } from "@/data/pgp";
import { assignGroupPolicy, usePgp } from "@/lib/pgp-store";

const PAGE = 10;

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

function ListShell({
  title,
  q,
  setQ,
  page,
  setPage,
  total,
  children,
}: {
  title: string;
  q: string;
  setQ: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="page-card">
        <div className="mb-5 flex items-center gap-3">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setPage(1))}
            placeholder="Type your search and press Enter"
            className="w-[420px]"
          />
          <div className="ml-auto">
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </div>
        </div>
        <div className="inv-frame">
          <div className="inv-scroll">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Key Compliance Group ──────────────────────────────────────────────────────

export function KeyGroupsPage() {
  const s = usePgp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = KEY_GROUPS.filter((g) =>
    `${g.name} ${g.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort(rows);
  const policyOf = (g: string) => s.policies.find((p) => p.groups.includes(g));
  const sshCount = (g: string) =>
    [...USER_KEYS, ...HOST_KEYS].filter((k) => k.keyComplianceGroup === g).length;
  const pgpCount = (g: string) => [...s.own, ...s.trusted].filter((k) => k.group === g).length;

  return (
    <ListShell
      title="Key Compliance Group"
      q={q}
      setQ={setQ}
      page={page}
      setPage={setPage}
      total={rows.length}
    >
      <table className="inv-table">
        <thead>
          <tr>
            <th>
              <SortHeader onClick={() => by("name", (g) => g.name)}>Group name</SortHeader>
            </th>
            <th>Description</th>
            <th>Key policy</th>
            <th>SSH keys</th>
            <th>PGP keys</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice((page - 1) * PAGE, page * PAGE).map((g) => {
            const pol = policyOf(g.name);
            return (
              <tr key={g.name}>
                <td className="font-medium">{g.name}</td>
                <td>{g.description}</td>
                <td>
                  <select
                    aria-label={`Key policy for ${g.name}`}
                    value={pol?.id ?? ""}
                    onChange={(e) => {
                      assignGroupPolicy(g.name, e.target.value);
                      toast.success(
                        `${g.name} now uses ${s.policies.find((p) => p.id === e.target.value)?.name}`,
                      );
                    }}
                    className="h-9 min-w-[200px] rounded-md border border-[#D1D5DB] bg-white px-2 text-[14px] focus:border-primary focus:outline-none"
                  >
                    {!pol && <option value="">No policy</option>}
                    {s.policies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Link to="/inventory/keys/user" className="text-primary hover:underline">
                    {sshCount(g.name)}
                  </Link>
                </td>
                <td>
                  <Link
                    to="/inventory/pgp"
                    search={{ tab: "own" }}
                    className="text-primary hover:underline"
                  >
                    {pgpCount(g.name)}
                  </Link>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <Empty cols={5} text="No groups match your search." />}
        </tbody>
      </table>
    </ListShell>
  );
}

// ─── Host Compliance Group ─────────────────────────────────────────────────────

export function HostGroupsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = HOST_GROUPS.filter((g) =>
    `${g.name} ${g.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort<HostGroup>(rows);
  return (
    <ListShell
      title="Host Compliance Group"
      q={q}
      setQ={setQ}
      page={page}
      setPage={setPage}
      total={rows.length}
    >
      <table className="inv-table">
        <thead>
          <tr>
            <th>
              <SortHeader onClick={() => by("name", (g) => g.name)}>Group name</SortHeader>
            </th>
            <th>Description</th>
            <th>Host policy</th>
            <th>Hosts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice((page - 1) * PAGE, page * PAGE).map((g) => (
            <tr key={g.name}>
              <td className="font-medium">{g.name}</td>
              <td>{g.description}</td>
              <td>
                <Link to="/policies/host" className="text-primary hover:underline">
                  {g.policy}
                </Link>
              </td>
              <td>{HOSTS.filter((h) => h.group === g.name).length}</td>
            </tr>
          ))}
          {rows.length === 0 && <Empty cols={4} text="No groups match your search." />}
        </tbody>
      </table>
    </ListShell>
  );
}

// ─── Infra Access Group ────────────────────────────────────────────────────────

export function InfraGroupsPage() {
  const s = usePgp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = s.infraGroups.filter((g) =>
    `${g.name} ${g.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort<InfraAccessGroup>(rows);
  return (
    <ListShell
      title="Infra Access Group"
      q={q}
      setQ={setQ}
      page={page}
      setPage={setPage}
      total={rows.length}
    >
      <table className="inv-table">
        <thead>
          <tr>
            <th>
              <SortHeader onClick={() => by("name", (g) => g.name.toLowerCase())}>
                Group name
              </SortHeader>
            </th>
            <th>Description</th>
            <th>
              <SortHeader onClick={() => by("hosts", (g) => g.hosts)}>Hosts</SortHeader>
            </th>
            <th>Created by</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice((page - 1) * PAGE, page * PAGE).map((g) => (
            <tr key={g.name}>
              <td className="font-medium">{g.name}</td>
              <td>{g.description}</td>
              <td>{g.hosts}</td>
              <td>{g.createdBy}</td>
            </tr>
          ))}
          {rows.length === 0 && <Empty cols={4} text="No groups match your search." />}
        </tbody>
      </table>
    </ListShell>
  );
}

// ─── Host Policy ───────────────────────────────────────────────────────────────

const HOST_POLICIES = [
  {
    name: "Default_Host_Policy",
    group: "Default_Host_Group, Prod_Host_Group",
    description: "Default policy for SSH hosts",
    details: [
      ["Allowed host key algorithms", "ED25519, ECDSA:521, RSA:3072"],
      ["Root login", "Not allowed"],
      ["Password authentication", "Not allowed"],
      ["Minimum OpenSSH version", "8.9"],
    ],
  },
  {
    name: "DMZ_Host_Policy",
    group: "DMZ_Host_Group",
    description: "Stricter settings for internet-facing hosts",
    details: [
      ["Allowed host key algorithms", "ED25519"],
      ["Root login", "Not allowed"],
      ["Password authentication", "Not allowed"],
      ["Minimum OpenSSH version", "9.6"],
    ],
  },
];

export function HostPolicyPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rows = HOST_POLICIES.filter((p) =>
    `${p.name} ${p.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <ListShell
      title="Host Policy"
      q={q}
      setQ={setQ}
      page={page}
      setPage={setPage}
      total={rows.length}
    >
      <table className="inv-table">
        <thead>
          <tr>
            <th style={{ width: 48 }} />
            <th>Policy name</th>
            <th>Group</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Fragment key={p.name}>
              <tr>
                <td>
                  <button
                    type="button"
                    aria-label={`Expand ${p.name}`}
                    className="rounded p-1 hover:bg-muted"
                    onClick={() => setOpen((o) => ({ ...o, [p.name]: !o[p.name] }))}
                  >
                    {open[p.name] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </td>
                <td className="text-[15px] text-primary">{p.name}</td>
                <td>{p.group}</td>
                <td>{p.description}</td>
              </tr>
              {open[p.name] && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      height: "auto",
                      whiteSpace: "normal",
                      maxWidth: "none",
                      background: "#F9FAFB",
                      padding: "14px 24px 14px 62px",
                    }}
                  >
                    <div className="grid grid-cols-4 gap-6 text-[14px]">
                      {p.details.map(([k, v]) => (
                        <div key={k}>
                          <div className="text-[13px] text-[#6B7280]">{k}</div>
                          <div className="mt-0.5">{v}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <Empty cols={4} text="No policies match your search." />}
        </tbody>
      </table>
    </ListShell>
  );
}

// ─── Tags ──────────────────────────────────────────────────────────────────────

export function TagsPage() {
  const s = usePgp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const counts = new Map<string, number>();
  for (const k of s.own) for (const t of k.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const rows = [...counts.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .filter((r) => r.tag.includes(q.trim().toLowerCase()));
  const { sorted, by } = useSort(rows, { key: "tag", get: (r) => r.tag });
  return (
    <ListShell title="Tags" q={q} setQ={setQ} page={page} setPage={setPage} total={rows.length}>
      <table className="inv-table">
        <thead>
          <tr>
            <th>
              <SortHeader onClick={() => by("tag", (r) => r.tag)}>Tag</SortHeader>
            </th>
            <th>
              <SortHeader onClick={() => by("n", (r) => r.n)}>Keys</SortHeader>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice((page - 1) * PAGE, page * PAGE).map((r) => (
            <tr key={r.tag}>
              <td>
                <span className="rounded bg-[#E5E7EB] px-2.5 py-1 text-[14px] text-[#374151]">
                  {r.tag}
                </span>
              </td>
              <td>{r.n}</td>
            </tr>
          ))}
          {rows.length === 0 && <Empty cols={2} text="No tags match your search." />}
        </tbody>
      </table>
    </ListShell>
  );
}

// ─── Get Started ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: Radar,
    title: "Discover hosts and keys",
    body: "Scan an IP range to find SSH user keys, host keys and PGP keys on your servers.",
    to: "/discovery/network-scan",
    cta: "Start a network scan",
  },
  {
    icon: ClipboardCheck,
    title: "Review the inventory",
    body: "See every key with its owner, location, age and risks in one place.",
    to: "/inventory/keys/user",
    cta: "Open Key Inventory",
  },
  {
    icon: Shield,
    title: "Set your key policy",
    body: "Choose allowed algorithms, maximum validity and where private keys are stored.",
    to: "/policies/key",
    cta: "Open Key Policy",
  },
  {
    icon: Wrench,
    title: "Fix what is at risk",
    body: "Rotate, revoke or remove keys that are weak, shared, expiring or out of policy.",
    to: "/dashboard",
    cta: "Open Dashboard",
  },
] as const;

export function GetStartedPage() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Get Started" />
      <div className="grid grid-cols-2 gap-6">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="flex gap-5 rounded-xl border border-border bg-white p-7"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">
                  Step {i + 1}
                </div>
                <div className="mt-1 text-[18px] font-semibold text-[#111827]">{step.title}</div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4B5563]">{step.body}</p>
                <button
                  type="button"
                  onClick={() => navigate({ to: step.to })}
                  className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
                >
                  {step.cta} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
