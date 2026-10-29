import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, CheckCircle2, Info, Loader2, Plus, RotateCw, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtDate, groupedFp, PGP_HOSTS, type OwnKey } from "@/data/pgp";
import { algoLabel, keyStatus, policyFor } from "@/lib/pgp-rules";
import {
  keyName,
  precheck,
  provisionKey,
  retryFailed,
  usePgp,
  type Destination,
  type RunResult,
} from "@/lib/pgp-store";
import { cn } from "@/lib/utils";
import { Note, ResultList } from "./PgpDialogs";
import { Pill, PurposeList, StatusBadge, derive } from "./pgp-ui";
import { Toggle } from "./pgp-form";

const STEPS = [
  "Key Summary",
  "Destination Configuration",
  "Vault Configuration",
  "Review & Confirm",
];

type Dest = { host: string; osUser: string };

export function ProvisionPgpKeyPage({ keyId }: { keyId?: string }) {
  const s = usePgp();
  const navigate = useNavigate();
  const eligible = s.own.filter((k) => {
    const st = keyStatus(k, policyFor(k.group, s.policies).expiringThreshold);
    return (
      k.management === "Managed" &&
      k.storage !== "Host only" &&
      st !== "Revoked" &&
      st !== "Retired" &&
      st !== "Expired"
    );
  });
  const [chosen, setChosen] = useState<string | undefined>(keyId);
  const k = s.own.find((x) => x.id === chosen);
  const [step, setStep] = useState(0);
  const [owner, setOwner] = useState<Dest>({ host: "", osUser: "" });
  const [copies, setCopies] = useState<Dest[]>([]);
  const [publish, setPublish] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);

  useEffect(() => setChosen(keyId), [keyId]);
  useEffect(() => {
    setStep(0);
    setResults(null);
    setCopies([]);
    const first = k?.privateLocations[0];
    setOwner(first ? { host: first.host, osUser: first.osUser } : { host: "", osUser: "" });
  }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  const vaultSkipped = k?.storage === "AppViewX";
  const dests: Destination[] = useMemo(
    () => [
      ...(owner.host && owner.osUser ? [{ ...owner, role: "Private key" as const }] : []),
      ...copies
        .filter((c) => c.host && c.osUser)
        .map((c) => ({ ...c, role: "Public copy" as const })),
    ],
    [owner, copies],
  );
  const duplicate = new Set(dests.map((d) => `${d.host}|${d.osUser}`)).size !== dests.length;

  if (!k) {
    return (
      <div className="max-w-3xl">
        <PageHeader
          breadcrumbs={["INVENTORY", "PGP KEY INVENTORY", "Own Keys", "Provision PGP Key"]}
          title="Provision PGP Key"
        />
        <div className="bg-surface border border-border rounded-md p-6 space-y-3">
          <div className="text-[13px]">
            Choose a key to provision. Only managed keys held in AppViewX or CyberArk that are not
            revoked, retired or expired are listed.
          </div>
          <Select
            value={chosen ?? ""}
            onValueChange={(v) => navigate({ to: "/inventory/pgp/provision", search: { key: v } })}
          >
            <SelectTrigger className="h-9 w-[360px]">
              <SelectValue placeholder="Select a key" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {keyName(x)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  const d = derive(k, s.policies);
  const canProvision = eligible.some((x) => x.id === k.id);
  const next = () => setStep((x) => (x === 1 && vaultSkipped ? 3 : x + 1));
  const back = () => setStep((x) => (x === 3 && vaultSkipped ? 1 : x - 1));

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
      setResults((cur) =>
        cur
          ? cur.map(
              (r) =>
                res.find(
                  (x) =>
                    x.dest.host === r.dest.host &&
                    x.dest.osUser === r.dest.osUser &&
                    x.dest.role === r.dest.role,
                ) ?? r,
            )
          : res,
      );
      const bad = res.filter((r) => r.outcome === "Failed").length;
      if (bad) toast.error(`${bad} still failing`);
      else toast.success("All failed locations placed on retry");
    }, 700);
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        breadcrumbs={["INVENTORY", "PGP KEY INVENTORY", "Own Keys", "Provision PGP Key"]}
        title={`Provision PGP Key: ${keyName(k)}`}
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map((label, i) => {
          const skipped = i === 2 && vaultSkipped;
          const doneStep = results ? true : i < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]",
                  i === step && !results
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : doneStep && !skipped
                      ? "border-risk-green/40 text-[#15803D]"
                      : "border-border text-muted-foreground",
                  skipped && "line-through opacity-60",
                )}
                title={skipped ? "Not needed for keys stored in AppViewX" : undefined}
              >
                {doneStep && !skipped ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-border rounded-md p-6">
        {!canProvision && !results && (
          <Note tone="danger">
            This key cannot be provisioned. It must be managed, held in AppViewX or CyberArk, and
            not revoked, retired or expired.
          </Note>
        )}

        {results ? (
          <RunView
            k={k}
            results={results}
            running={running}
            onRetry={retry}
            onAddCopies={() => (setResults(null), setStep(1), setCopies([]))}
          />
        ) : step === 0 ? (
          <div className="space-y-4">
            <h3 className="text-[14px] font-semibold">Key Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-[13px]">
              <Info2 label="Name" value={keyName(k)} />
              <Info2 label="Status" value={<StatusBadge status={d.status} />} />
              <Info2 label="Algorithm" value={algoLabel(k.primary.algo)} />
              <Info2
                label="Fingerprint"
                value={
                  <span className="font-mono text-[12px]">{groupedFp(k.primary.fingerprint)}</span>
                }
                className="col-span-2"
              />
              <Info2 label="Purpose" value={<PurposeList list={d.purposes} />} />
              <Info2 label="Stored in" value={k.storage} />
              <Info2 label="Key group" value={`${k.group} (${d.policy.name})`} />
              <Info2
                label="Expires"
                value={k.primary.expires ? fmtDate(k.primary.expires) : "No expiry"}
              />
              <Info2
                label="Private key locations"
                value={
                  k.privateLocations.length
                    ? k.privateLocations.map((l) => `${l.host} / ${l.osUser}`).join(", ")
                    : "Not provisioned"
                }
                className="col-span-2"
              />
              <Info2
                label="Public copies"
                value={
                  k.publicCopies.length
                    ? k.publicCopies.map((l) => `${l.host} / ${l.osUser}`).join(", ")
                    : "None"
                }
              />
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-5">
            <h3 className="text-[14px] font-semibold">Destination Configuration</h3>
            <div>
              <div className="text-[12px] font-medium mb-1">Private key owner</div>
              <div className="text-[11px] text-muted-foreground mb-2">
                Exactly one host and OS user gets the private key on each run. It is imported into
                that user's GnuPG keyring.
              </div>
              <DestPicker value={owner} onChange={setOwner} k={k} role="Private key" />
            </div>
            <div>
              <div className="text-[12px] font-medium mb-1">Public copies (optional)</div>
              <div className="text-[11px] text-muted-foreground mb-2">
                Hosts that only need to encrypt to this key or verify its signatures.
              </div>
              <div className="space-y-2">
                {copies.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <DestPicker
                      value={c}
                      onChange={(v) => setCopies((x) => x.map((y, j) => (j === i ? v : y)))}
                      k={k}
                      role="Public copy"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCopies((x) => x.filter((_, j) => j !== i))}
                      aria-label="Remove public copy"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCopies((x) => [...x, { host: "", osUser: "" }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add public copy
                </Button>
              </div>
            </div>
            {duplicate && <Note tone="danger">The same host and OS user is listed twice.</Note>}
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            <h3 className="text-[14px] font-semibold">Vault Configuration</h3>
            <div className="text-[12px] text-muted-foreground">
              Set at key creation. The private key and passphrase are fetched from CyberArk when
              placed on the host.
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-2xl">
              {k.vault &&
                (
                  [
                    ["Vault configuration", k.vault.vaultConfig],
                    ["Safe name", k.vault.safeName],
                    ["User name", k.vault.userName],
                    ["PAM account name", k.vault.pamAccountName],
                    ["Server address", k.vault.serverAddress],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l}>
                    <div className="text-[11px] text-muted-foreground mb-1">{l}</div>
                    <div className="h-8 px-2 flex items-center rounded border border-border bg-muted/50 text-[12px]">
                      {v}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <Review
            k={k}
            dests={dests}
            publish={publish}
            setPublish={setPublish}
            keyserver={s.settings.keyserver}
          />
        )}

        {!results && (
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button variant="outline" asChild>
              <Link to="/inventory/pgp/own">Cancel</Link>
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={back}>
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button
                  onClick={next}
                  disabled={
                    !canProvision ||
                    (step === 1 &&
                      (!owner.host ||
                        !owner.osUser ||
                        duplicate ||
                        copies.some((c) => !c.host || !c.osUser)))
                  }
                >
                  Next
                </Button>
              ) : (
                <Button onClick={run} disabled={running || !dests.length}>
                  {running && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}Provision
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info2({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function DestPicker({
  value,
  onChange,
  k,
  role,
}: {
  value: Dest;
  onChange: (d: Dest) => void;
  k: OwnKey;
  role: Destination["role"];
}) {
  const host = PGP_HOSTS.find((h) => h.name === value.host);
  const pc = value.host && value.osUser ? precheck(k, { ...value, role }) : null;
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.host}
        onValueChange={(v) =>
          onChange({ host: v, osUser: PGP_HOSTS.find((h) => h.name === v)?.users[0] ?? "" })
        }
      >
        <SelectTrigger className="h-8 w-[200px] text-[13px]" aria-label={`${role} host`}>
          <SelectValue placeholder="Host" />
        </SelectTrigger>
        <SelectContent>
          {PGP_HOSTS.map((h) => (
            <SelectItem key={h.name} value={h.name}>
              {h.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.osUser}
        onValueChange={(v) => onChange({ ...value, osUser: v })}
        disabled={!host}
      >
        <SelectTrigger className="h-8 w-[150px] text-[13px]" aria-label={`${role} OS user`}>
          <SelectValue placeholder="OS user" />
        </SelectTrigger>
        <SelectContent>
          {(host?.users ?? []).map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pc && pc.ok && pc.already && <Pill>Already present, will be skipped</Pill>}
      {pc && !pc.ok && <span className="text-[11px] text-risk-red">{pc.reason}</span>}
    </div>
  );
}

function Review({
  k,
  dests,
  publish,
  setPublish,
  keyserver,
}: {
  k: OwnKey;
  dests: Destination[];
  publish: boolean;
  setPublish: (v: boolean) => void;
  keyserver: string;
}) {
  const rows = dests.map((d) => ({ d, pc: precheck(k, d) }));
  const failing = rows.filter((r) => !r.pc.ok).length;
  return (
    <div className="space-y-4">
      <h3 className="text-[14px] font-semibold">Review & Confirm</h3>
      <div className="text-[12px] text-muted-foreground">
        Pre-checks run against each location before anything is placed.
      </div>
      <table className="w-full text-[12px] border border-border rounded">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Host / OS user</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Pre-checks</th>
            <th className="px-3 py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ d, pc }) => (
            <tr
              key={`${d.host}|${d.osUser}|${d.role}`}
              className="border-t border-border align-top"
            >
              <td className="px-3 py-2 font-medium">
                {d.host} / {d.osUser}
              </td>
              <td className="px-3 py-2">{d.role}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {pc.checks.join(" · ") || "None run"}
              </td>
              <td className="px-3 py-2">
                {!pc.ok ? (
                  <span className="inline-flex items-center gap-1 text-risk-red">
                    <XCircle className="h-3.5 w-3.5" /> {pc.reason}
                  </span>
                ) : pc.already ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Info className="h-3.5 w-3.5" /> Skip, already present
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[#15803D]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {failing > 0 && (
        <Note tone="warn">
          {failing} location{failing > 1 ? "s" : ""} failed pre-checks and will be reported as
          failed. The rest will still be placed.
        </Note>
      )}
      <div className="flex items-center gap-3 rounded border border-border p-3">
        <Toggle
          checked={publish}
          onChange={setPublish}
          disabled={!keyserver}
          label="Publish public key"
        />
        <div className="text-[12px]">
          <div className="font-medium">Publish the public key after provisioning</div>
          <div className="text-muted-foreground">
            {keyserver
              ? `Uploads to ${keyserver}.`
              : "Set a keyserver in Administration > PGP Settings to publish."}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunView({
  k,
  results,
  running,
  onRetry,
  onAddCopies,
}: {
  k: OwnKey;
  results: RunResult[];
  running: boolean;
  onRetry: () => void;
  onAddCopies: () => void;
}) {
  const failed = results.filter((r) => r.outcome === "Failed").length;
  const ok = results.filter((r) => r.outcome === "Succeeded").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[14px] font-semibold">
        {failed ? (
          <XCircle className="h-5 w-5 text-risk-amber" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-risk-green" />
        )}
        {failed ? `${ok} placed, ${failed} failed` : "Provisioning complete"}
      </div>
      <ResultList results={results} />
      <div className="flex gap-2 pt-2">
        {failed > 0 && (
          <Button onClick={onRetry} disabled={running}>
            {running ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5 mr-1" />
            )}
            Retry failed
          </Button>
        )}
        <Button variant="outline" onClick={onAddCopies}>
          Run again to add public copies
        </Button>
        <Button variant="outline" asChild>
          <Link to="/inventory/pgp/own">Back to Own Keys</Link>
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {keyName(k)} now has {k.privateLocations.length} private key location
        {k.privateLocations.length === 1 ? "" : "s"} and {k.publicCopies.length} public cop
        {k.publicCopies.length === 1 ? "y" : "ies"}.
      </div>
    </div>
  );
}
