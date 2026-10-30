import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ClipboardCheck, KeyRound, Loader2, Lock, Plus, RotateCw, Search, Server, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { PillSwitch, PrimaryButton, SecondaryButton } from "@/components/common/ProductForm";
import { fmtDate, groupedFp, PGP_HOSTS, type OwnKey } from "@/data/pgp";
import { algoLabel, keyStatus, policyFor } from "@/lib/pgp-rules";
import { keyName, precheck, provisionKey, retryFailed, usePgp, type Destination, type RunResult } from "@/lib/pgp-store";
import { cn } from "@/lib/utils";
import { ResultList } from "./PgpDialogs";
import { derive, DotPill, PanelTable, PurposeList, StatusBadge } from "./pgp-ui";

type Dest = { host: string; osUser: string };
type StepDef = { title: string; sub: string; icon: ComponentType<{ className?: string }> };
const STEPS: StepDef[] = [
  { title: "Key Summary", sub: "What is being provisioned", icon: KeyRound },
  { title: "Destination Configuration", sub: "Owner and public copies", icon: Server },
  { title: "Vault Configuration", sub: "Where the key is fetched from", icon: Lock },
  { title: "Review & Confirm", sub: "Check every destination", icon: ClipboardCheck },
];
const KEYRING = "~/.gnupg";

export function ProvisionPgpKeyPage({ keyId }: { keyId?: string }) {
  const s = usePgp();
  const navigate = useNavigate();
  const eligible = s.own.filter((k) => {
    const st = keyStatus(k, policyFor(k.group, s.policies).expiringThreshold);
    return k.management === "Managed" && k.storage !== "Host only" && st !== "Revoked" && st !== "Retired" && st !== "Expired";
  });
  const k = s.own.find((x) => x.id === keyId);
  const [step, setStep] = useState(0);
  const [owner, setOwner] = useState<Dest>({ host: "", osUser: "" });
  const [editOwner, setEditOwner] = useState(false);
  const [copies, setCopies] = useState<Dest[]>([]);
  const [publish, setPublish] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);

  useEffect(() => {
    setStep(0);
    setResults(null);
    setCopies([]);
    const first = k?.privateLocations[0];
    setOwner(first ? { host: first.host, osUser: first.osUser } : { host: "", osUser: "" });
    setEditOwner(!first);
  }, [keyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dests: Destination[] = useMemo(
    () => [...(owner.host && owner.osUser ? [{ ...owner, role: "Private key" as const }] : []), ...copies.filter((c) => c.host && c.osUser).map((c) => ({ ...c, role: "Public copy" as const }))],
    [owner, copies],
  );

  const parents = [{ label: "PGP Key Inventory", to: "/inventory/pgp", search: { tab: "own" } }];

  if (!k) {
    return (
      <div>
        <PageHeader parents={parents} title="Provision PGP Key" />
        <div className="page-card max-w-[720px] space-y-4 !p-8">
          <div className="text-[14px] text-[#374151]">Choose a key to provision. Only managed keys held in AppViewX or CyberArk that are not revoked, retired or expired are listed.</div>
          <select
            aria-label="Key to provision"
            value=""
            onChange={(e) => navigate({ to: "/inventory/pgp/provision", search: { key: e.target.value } })}
            className="h-[38px] w-[420px] rounded-md border border-[#D1D5DB] bg-white px-3 text-[14px] focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              Select a key
            </option>
            {eligible.map((x) => (
              <option key={x.id} value={x.id}>
                {keyName(x)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const d = derive(k, s.policies);
  const canProvision = eligible.some((x) => x.id === k.id);
  const vaultSkipped = k.storage !== "CyberArk";
  const checked = dests.map((x) => ({ d: x, pc: precheck(k, x) }));
  const failing = checked.filter((r) => !r.pc.ok);
  const duplicate = new Set(dests.map((x) => `${x.host}|${x.osUser}`)).size !== dests.length;
  const step1Blocked = !owner.host || !owner.osUser || duplicate || failing.length > 0 || copies.some((c) => !c.host || !c.osUser);

  const next = () => setStep((x) => (x === 1 && vaultSkipped ? 3 : x + 1));
  const back = () => setStep((x) => (x === 3 && vaultSkipped ? 1 : x - 1));
  const cancel = () => navigate({ to: "/inventory/pgp", search: { tab: "own" } });

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const res = provisionKey(k.id, dests, publish);
      setResults(res);
      setRunning(false);
      const bad = res.filter((r) => r.outcome === "Failed").length;
      if (bad) toast.error(`${bad} location${bad > 1 ? "s" : ""} failed. You can retry them.`);
      else toast.success(`${keyName(k)} provisioned`);
    }, 900);
  };
  const retry = () => {
    setRunning(true);
    setTimeout(() => {
      const res = retryFailed(k.id);
      setRunning(false);
      setResults((cur) => (cur ? cur.map((r) => res.find((x) => x.dest.host === r.dest.host && x.dest.osUser === r.dest.osUser && x.dest.role === r.dest.role) ?? r) : res));
      const bad = res.filter((r) => r.outcome === "Failed").length;
      if (bad) toast.error(`${bad} still failing`);
      else toast.success("All failed locations placed on retry");
    }, 700);
  };

  return (
    <div>
      <PageHeader parents={parents} title="Provision PGP Key" />
      <div className="flex min-h-[600px] overflow-hidden rounded-lg border border-border bg-white">
        {/* Left: steps */}
        <aside className="w-[300px] shrink-0 border-r border-border bg-[#FAFBFC] px-5 py-6">
          <div className="mb-1 text-[17px] font-semibold text-[#111827]">Provision PGP Key</div>
          <div className="mb-5 truncate text-[13px] text-[#6B7280]" title={keyName(k)}>
            {keyName(k)}
          </div>
          <ol className="space-y-2.5">
            {STEPS.map((st, i) => {
              const skipped = i === 2 && vaultSkipped;
              const current = !results && i === step;
              const done = !!results || (i < step && !skipped);
              const Icon = st.icon;
              return (
                <li
                  key={st.title}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-white px-3 py-3",
                    current ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]" : done ? "border-[#86EFAC]" : "border-[#E5E7EB]",
                    skipped && "opacity-55",
                  )}
                  title={skipped ? "Not needed: the private key is held in AppViewX" : undefined}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", done && !skipped ? "bg-[#DCFCE7] text-[#15803D]" : current ? "bg-primary text-white" : "bg-[#EEF1F8] text-[#4B5563]")}>
                    {done && !skipped ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13.5px] font-medium", current ? "text-primary" : "text-[#111827]")}>{st.title}</span>
                    <span className="block truncate text-[12px] text-[#6B7280]">{skipped ? "Skipped for AppViewX storage" : st.sub}</span>
                  </span>
                  {current && <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Right: step content */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 px-8 py-6">
            {!canProvision && !results && (
              <Banner tone="red">This key cannot be provisioned. It must be managed, held in AppViewX or CyberArk, and not revoked, retired or expired.</Banner>
            )}
            {results ? (
              <RunView k={k} results={results} running={running} onRetry={retry} onAddCopies={() => (setResults(null), setStep(1), setCopies([]))} />
            ) : step === 0 ? (
              <>
                <StepTitle>Key Summary</StepTitle>
                <p className="mb-5 text-[13px] italic text-[#6B7280]">Everything here is read-only. A different key means creating a new one.</p>
                <div className="grid max-w-[760px] grid-cols-2 gap-x-6 gap-y-4">
                  <Locked label="Key Name" value={keyName(k)} />
                  <Locked label="Status" value={<StatusBadge status={d.status} />} />
                  <Locked label="Fingerprint" value={<span className="font-mono text-[12.5px]">{groupedFp(k.primary.fingerprint)}</span>} wide />
                  <Locked label="Algorithm" value={algoLabel(k.primary.algo)} />
                  <Locked label="Purpose" value={<PurposeList list={d.purposes} />} />
                  <Locked label="Expires" value={k.primary.expires ? fmtDate(k.primary.expires) : "No expiry"} />
                  <Locked label="Storage" value={k.storage} />
                  <Locked label="Key Group" value={k.group} />
                  <Locked label="Key Policy" value={d.policy.name} />
                  <Locked label="Private Key On" value={k.privateLocations.length ? k.privateLocations.map((l) => `${l.host} / ${l.osUser}`).join(", ") : "Not provisioned"} wide />
                </div>
              </>
            ) : step === 1 ? (
              <>
                <StepTitle>Destination Configuration</StepTitle>
                <SubHead title="Private key" hint="exactly one owner" />
                <p className="mb-2.5 text-[12.5px] text-[#6B7280]">The private key is imported into this OS user's GnuPG keyring. Only one host and user can hold it.</p>
                <PanelTable
                  head={["Host", "OS user", "Keyring", "Pre-check", ""]}
                  rows={[
                    editOwner
                      ? [
                          <HostSelect value={owner.host} onChange={(h) => setOwner({ host: h, osUser: PGP_HOSTS.find((x) => x.name === h)?.users[0] ?? "" })} label="Private key host" />,
                          <UserSelect host={owner.host} value={owner.osUser} onChange={(u) => setOwner((o) => ({ ...o, osUser: u }))} label="Private key OS user" />,
                          <span className="font-mono text-[12px]">{KEYRING}</span>,
                          <Precheck k={k} dest={owner} role="Private key" />,
                          owner.host ? (
                            <button className="text-[13px] text-primary hover:underline" onClick={() => setEditOwner(false)}>
                              Done
                            </button>
                          ) : null,
                        ]
                      : [
                          owner.host,
                          owner.osUser,
                          <span className="font-mono text-[12px]">{KEYRING}</span>,
                          <Precheck k={k} dest={owner} role="Private key" />,
                          <button className="text-[13px] text-primary hover:underline" onClick={() => setEditOwner(true)}>
                            Change
                          </button>,
                        ],
                  ]}
                />
                <div className="mt-7" />
                <SubHead title="Public copies" hint="optional" />
                <p className="mb-2.5 text-[12.5px] text-[#6B7280]">Hosts that only encrypt to this key or verify its signatures get the public key.</p>
                <CopyAdder
                  onAdd={(h) => {
                    const host = PGP_HOSTS.find((x) => x.name === h);
                    if (host) setCopies((c) => [...c, { host: host.name, osUser: host.users[0] }]);
                  }}
                />
                <PanelTable
                  head={["Host", "OS user", "Keyring", "Pre-check", ""]}
                  empty="No public copies. Search for a host and add it."
                  rows={copies.map((c, i) => [
                    c.host,
                    <UserSelect host={c.host} value={c.osUser} onChange={(u) => setCopies((x) => x.map((y, j) => (j === i ? { ...y, osUser: u } : y)))} label={`OS user for ${c.host}`} />,
                    <span className="font-mono text-[12px]">{KEYRING}</span>,
                    <Precheck k={k} dest={c} role="Public copy" />,
                    <button aria-label={`Remove ${c.host}`} className="rounded p-1 text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626]" onClick={() => setCopies((x) => x.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </button>,
                  ])}
                />
                {duplicate && <Banner tone="red">The same host and OS user is listed twice. Remove one of them.</Banner>}
                {failing.length > 0 && (
                  <Banner tone="red">
                    {failing.length} host{failing.length > 1 ? "s" : ""} failed the pre-check. Fix or remove {failing.length > 1 ? "them" : "it"} before continuing.
                  </Banner>
                )}
              </>
            ) : step === 2 ? (
              <>
                <StepTitle>Vault Configuration</StepTitle>
                <div className="mb-4">
                  <DotPill tone="grey">Set at key creation</DotPill>
                </div>
                <div className="grid max-w-[760px] grid-cols-2 gap-x-6 gap-y-4">
                  <Locked label="Vault Vendor" value={k.vault?.vendor ?? "CyberArk"} />
                  <Locked label="Vault Config" value={k.vault?.vaultConfig ?? "—"} />
                  <Locked label="Safe Name" value={k.vault?.safeName ?? "—"} />
                  <Locked label="User Name" value={k.vault?.userName ?? "—"} />
                  <Locked label="PAM Account Name" value={k.vault?.pamAccountName ?? "—"} />
                  <Locked label="Server Address" value={k.vault?.serverAddress ?? "—"} />
                </div>
                <p className="mt-5 text-[13px] italic text-[#6B7280]">The private key and passphrase are fetched from this CyberArk account when they are placed on the host. Nothing is stored on the AppViewX server.</p>
              </>
            ) : (
              <Review k={k} dests={dests} publish={publish} setPublish={setPublish} keyserver={s.settings.keyserver} />
            )}
          </div>

          {!results && (
            <div className="flex items-center justify-between border-t border-border px-8 py-4">
              <div>{step > 0 && <SecondaryButton onClick={back}>Back</SecondaryButton>}</div>
              <div className="flex gap-3">
                <SecondaryButton onClick={cancel}>Cancel</SecondaryButton>
                {step < 3 ? (
                  <PrimaryButton onClick={next} disabled={!canProvision || (step === 1 && step1Blocked)}>
                    Next
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={run} disabled={running || !dests.length || failing.length > 0}>
                    <span className="inline-flex items-center gap-1.5">
                      {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Confirm &amp; Provision Key
                    </span>
                  </PrimaryButton>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StepTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-[17px] font-medium text-primary">{children}</h2>;
}

function SubHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-1 text-[14px] font-medium text-[#111827]">
      {title} <span className="font-normal text-[#6B7280]">· {hint}</span>
    </div>
  );
}

function Locked({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="mb-1.5 text-[13px] text-[#4B5563]">{label}</div>
      <div className="flex min-h-[38px] items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] px-3 py-1.5 text-[13.5px] text-[#1F2937]">
        <span className="min-w-0 break-words">{value}</span>
        <Lock className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "red" | "amber"; children: ReactNode }) {
  return (
    <div className={cn("mt-4 flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px]", tone === "red" ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]" : "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]")}>
      <AlertCircle className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

const selectCls = "h-8 w-full rounded-md border border-[#D1D5DB] bg-white px-2 text-[13px] focus:border-primary focus:outline-none disabled:bg-[#F5F6F8]";

function HostSelect({ value, onChange, label }: { value: string; onChange: (h: string) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(selectCls, "min-w-[170px]")}>
      <option value="" disabled>
        Select host
      </option>
      {PGP_HOSTS.map((h) => (
        <option key={h.name} value={h.name}>
          {h.name}
        </option>
      ))}
    </select>
  );
}

function UserSelect({ host, value, onChange, label }: { host: string; value: string; onChange: (u: string) => void; label: string }) {
  const users = PGP_HOSTS.find((h) => h.name === host)?.users ?? [];
  return (
    <select aria-label={label} value={value} disabled={!host} onChange={(e) => onChange(e.target.value)} className={cn(selectCls, "min-w-[110px]")}>
      {!host && <option value="">OS user</option>}
      {users.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

function Precheck({ k, dest, role }: { k: OwnKey; dest: Dest; role: Destination["role"] }) {
  if (!dest.host || !dest.osUser) return <span className="text-[#9CA3AF]">Not run</span>;
  const pc = precheck(k, { ...dest, role });
  if (!pc.ok)
    return (
      <span title={pc.reason}>
        <DotPill tone="red">Failed</DotPill>
        <span className="mt-1 block max-w-[220px] whitespace-normal text-[12px] text-[#DC2626]">{pc.reason}</span>
      </span>
    );
  if (pc.already)
    return (
      <span title="Already present, will be skipped">
        <DotPill tone="grey">Already present</DotPill>
      </span>
    );
  return (
    <span title={pc.checks.join(" · ")}>
      <DotPill tone="green">Passed</DotPill>
    </span>
  );
}

function CopyAdder({ onAdd }: { onAdd: (host: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = PGP_HOSTS.filter((h) => h.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const add = (h: string) => {
    onAdd(h);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="relative w-[340px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
        <input
          aria-label="Search hosts"
          value={q}
          onChange={(e) => (setQ(e.target.value), setOpen(true))}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Enter" && matches[0] && add(matches[0].name)}
          placeholder="Search hosts in Host Inventory"
          className="h-8 w-full rounded-md border border-[#D1D5DB] bg-white pl-9 pr-3 text-[13px] placeholder:text-[#9CA3AF] focus:border-primary focus:outline-none"
        />
        {open && matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-9 z-20 max-h-64 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg" role="listbox">
            {matches.map((h) => (
              <li key={h.name}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(h.name)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-[#F3F4F6]">
                  <span>{h.name}</span>
                  <span className="text-[12px] text-[#6B7280]">{h.reachable ? `GnuPG ${h.gnupg ?? "missing"}` : "Unreachable"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => (matches[0] && q ? add(matches[0].name) : setOpen(true))}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3 text-[13px] text-[#1F2937] hover:bg-[#F9FAFB]"
      >
        <Plus className="h-3.5 w-3.5" /> Add host
      </button>
    </div>
  );
}

function Review({ k, dests, publish, setPublish, keyserver }: { k: OwnKey; dests: Destination[]; publish: boolean; setPublish: (v: boolean) => void; keyserver: string }) {
  const priv = dests.filter((x) => x.role === "Private key");
  const pub = dests.filter((x) => x.role === "Public copy");
  const tile = (label: string, value: ReactNode) => (
    <div className="px-4 py-3">
      <div className="text-[12px] uppercase tracking-[0.06em] text-[#6B7280]">{label}</div>
      <div className="mt-1 text-[15px] font-medium text-[#111827]">{value}</div>
    </div>
  );
  return (
    <>
      <StepTitle>Review &amp; Confirm</StepTitle>
      <div className="mb-6 grid grid-cols-4 divide-x divide-[#EDEFF3] rounded-lg border border-border bg-[#FAFBFC]">
        {tile("Key type", algoLabel(k.primary.algo))}
        {tile("Private key", `${priv.length} host`)}
        {tile("Public copies", `${pub.length} host${pub.length === 1 ? "" : "s"}`)}
        {tile("Storage", k.storage)}
      </div>
      <div className="mb-2.5 text-[14px] text-[#111827]">Every destination, and exactly what it receives:</div>
      <PanelTable
        head={["Host", "Receives", "OS user", "Keyring"]}
        rows={dests.map((x) => {
          const pc = precheck(k, x);
          return [
            x.host,
            <span className="inline-flex items-center gap-2">
              <DotPill tone={x.role === "Private key" ? "purple" : "grey"}>{x.role === "Private key" ? "Private key" : "Public key"}</DotPill>
              {pc.ok && pc.already && <span className="text-[12px] text-[#6B7280]">already present, skipped</span>}
            </span>,
            x.osUser,
            <span className="font-mono text-[12px]">{KEYRING}</span>,
          ];
        })}
      />
      <div className="mt-6 flex items-start gap-3">
        <PillSwitch value={publish} onChange={setPublish} disabled={!keyserver} label="Publish public key to keyserver" />
        <div className="pt-1.5">
          <div className="text-[14px] text-[#111827]">Publish public key to keyserver</div>
          <div className="text-[12.5px] italic text-[#6B7280]">{keyserver ? `Uploads the public key to ${keyserver} once provisioning finishes.` : "Set a keyserver in Administration > PGP Settings to publish."}</div>
        </div>
      </div>
    </>
  );
}

function RunView({ k, results, running, onRetry, onAddCopies }: { k: OwnKey; results: RunResult[]; running: boolean; onRetry: () => void; onAddCopies: () => void }) {
  const failed = results.filter((r) => r.outcome === "Failed").length;
  const ok = results.filter((r) => r.outcome === "Succeeded").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[16px] font-medium">
        {failed ? <XCircle className="h-5 w-5 text-[#D97706]" /> : <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />}
        {failed ? `${ok} placed, ${failed} failed` : "Provisioning complete"}
      </div>
      <ResultList results={results} />
      <div className="flex flex-wrap gap-3 pt-2">
        {failed > 0 && (
          <PrimaryButton onClick={onRetry} disabled={running}>
            <span className="inline-flex items-center gap-1.5">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              Retry failed
            </span>
          </PrimaryButton>
        )}
        <SecondaryButton onClick={onAddCopies}>Run again to add public copies</SecondaryButton>
        <Link to="/inventory/pgp" search={{ tab: "own" }} className="inline-flex h-9 items-center rounded-md border border-[#D1D5DB] bg-white px-5 text-[14px] text-[#1F2937] hover:bg-[#F9FAFB]">
          Back to Own Keys
        </Link>
      </div>
      <div className="text-[12.5px] text-[#6B7280]">
        {keyName(k)} now has {k.privateLocations.length} private key location{k.privateLocations.length === 1 ? "" : "s"} and {k.publicCopies.length} public cop{k.publicCopies.length === 1 ? "y" : "ies"}.
      </div>
    </div>
  );
}
