import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtDate, groupedFp, PGP_GROUPS, rel, type PgpPolicy, type Purpose } from "@/data/pgp";
import { policyFor } from "@/lib/pgp-rules";
import { generateKey, keyName, usePgp, type GenerateInput } from "@/lib/pgp-store";
import { FormRow, FormSection, Toggle } from "./pgp-form";
import { Note } from "./PgpDialogs";
import type { OwnKey } from "@/data/pgp";

export function allowedAlgorithms(p: PgpPolicy): string[] {
  const out: string[] = [];
  if (p.algorithms.includes("ED25519")) out.push("Ed25519");
  for (const n of [2048, 3072, 4096]) if (p.algorithms.includes(`RSA:${n}`)) out.push(`RSA ${n}`);
  for (const c of ["P-256", "P-384", "P-521"])
    if (p.algorithms.includes(`ECDSA:${c}`)) out.push(`ECDSA ${c}`);
  return out;
}

const PURPOSES: Purpose[] = ["Encrypt", "Sign", "Authenticate"];

export function GeneratePgpKeyPage() {
  const s = usePgp();
  const navigate = useNavigate();
  const [group, setGroup] = useState("Default_Key_Group");
  const policy = policyFor(group, s.policies);
  const algos = useMemo(() => allowedAlgorithms(policy), [policy]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [extra, setExtra] = useState<{ name: string; email: string }[]>([]);
  const [algorithm, setAlgorithm] = useState("Ed25519");
  const [primaryNoExpiry, setPrimaryNoExpiry] = useState(false);
  const [primaryDays, setPrimaryDays] = useState("730");
  const [subs, setSubs] = useState<Record<Purpose, { on: boolean; days: string }>>({
    Encrypt: { on: true, days: "365" },
    Sign: { on: false, days: "365" },
    Authenticate: { on: false, days: "365" },
  });
  const [passMode, setPassMode] = useState<"Generated" | "Entered">("Generated");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [cyberArk, setCyberArk] = useState(false);
  const [pamName, setPamName] = useState("");
  const [tags, setTags] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<OwnKey | null>(null);

  // Policy-driven defaults whenever the group changes.
  useEffect(() => {
    setAlgorithm(
      algos.includes(policy.rotationAlgorithm) ? policy.rotationAlgorithm : (algos[0] ?? ""),
    );
    setPrimaryDays(
      String(policy.maxValidityPrimary ? Math.min(730, policy.maxValidityPrimary) : 730),
    );
    setPrimaryNoExpiry(false);
    setSubs((cur) => {
      const next = { ...cur };
      for (const p of PURPOSES)
        next[p] = {
          on: policy.requiredSubkeys.includes(p) || cur[p].on,
          days: String(policy.maxValiditySubkeys ? Math.min(365, policy.maxValiditySubkeys) : 365),
        };
      return next;
    });
    setCyberArk(!!policy.cyberArk?.required);
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  const pamDefault = (policy.cyberArk?.pamFormat ?? "pgp-{key name}").replace(
    "{key name}",
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") || "key-name",
  );

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "Enter a name";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address";
  if (!algorithm || !algos.includes(algorithm))
    errors.algorithm = "Choose an algorithm the policy allows";
  const pd = Number(primaryDays);
  if (!primaryNoExpiry) {
    if (!Number.isFinite(pd) || pd < 1) errors.primary = "Enter the number of days";
    else if (policy.maxValidityPrimary !== null && pd > policy.maxValidityPrimary)
      errors.primary = `${policy.name} allows at most ${policy.maxValidityPrimary} days`;
  }
  for (const p of PURPOSES) {
    if (!subs[p].on) continue;
    const d = Number(subs[p].days);
    if (!Number.isFinite(d) || d < 1) errors[`sub-${p}`] = "Enter the number of days";
    else if (policy.maxValiditySubkeys !== null && d > policy.maxValiditySubkeys)
      errors[`sub-${p}`] = `At most ${policy.maxValiditySubkeys} days`;
    else if (!primaryNoExpiry && d > pd) errors[`sub-${p}`] = "Cannot outlast the primary key";
  }
  if (passMode === "Entered") {
    if (pass1.length < 12) errors.pass = "Use at least 12 characters";
    else if (pass1 !== pass2) errors.pass = "The passphrases do not match";
  }
  const ok = Object.keys(errors).length === 0;

  const submit = () => {
    setSubmitted(true);
    if (!ok) return;
    const input: GenerateInput = {
      group,
      name: name.trim(),
      email: email.trim(),
      comment: comment.trim(),
      extraUserIds: extra,
      algorithm,
      primaryValidity: primaryNoExpiry ? null : pd,
      subkeys: PURPOSES.filter((p) => subs[p].on).map((p) => ({
        purpose: p,
        validity: Number(subs[p].days),
      })),
      passphrase: passMode,
      storage: cyberArk ? "CyberArk" : "AppViewX",
      vault:
        cyberArk && policy.cyberArk
          ? {
              vendor: "CyberArk",
              vaultConfig: policy.cyberArk.vaultConfig,
              safeName: policy.cyberArk.safeName,
              userName: policy.cyberArk.userName,
              pamAccountName: pamName || pamDefault,
              serverAddress: policy.cyberArk.serverAddress,
            }
          : undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const k = generateKey(input);
    setCreated(k);
    toast.success(`${input.name} generated`);
  };

  if (created) {
    return (
      <div>
        <PageHeader
          parents={[{ label: "PGP Key Inventory", to: "/inventory/pgp", search: { tab: "own" } }]}
          title="Generate PGP Key"
        />
        <div className="rounded-xl border border-border bg-white px-12 py-10">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <CheckCircle2 className="h-5 w-5 text-risk-green" /> {keyName(created)} is ready
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-[14px]">
            <div>
              <div className="text-[12px] text-muted-foreground">Fingerprint</div>
              <div className="font-mono text-[13px]">{groupedFp(created.primary.fingerprint)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">Stored in</div>
              {created.storage}
              {created.vault && `, safe ${created.vault.safeName}`}
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">Revocation certificate</div>
              Created and stored in {created.revCertWhere}
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">In Own Keys as</div>
              Managed, Hosts: Not provisioned
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              onClick={() =>
                navigate({ to: "/inventory/pgp/provision", search: { key: created.id } })
              }
            >
              Provision PGP Key
            </Button>
            <Button variant="outline" asChild>
              <Link to="/inventory/pgp" search={{ tab: "own" }}>
                Go to Own Keys
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const show = (k: string) => (submitted ? errors[k] : undefined);

  return (
    <div>
      <PageHeader
        parents={[{ label: "PGP Key Inventory", to: "/inventory/pgp", search: { tab: "own" } }]}
        title="Generate PGP Key"
      />
      <div className="rounded-xl border border-border bg-white px-12 py-10">
        <FormSection title="Key group">
          <FormRow label="Key group" required hint={`Settings below follow ${policy.name}.`}>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="h-9 w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PGP_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        </FormSection>

        <FormSection title="User ID">
          <FormRow
            label="Name"
            required
            error={show("name")}
            hint="Usually the team, service or partner exchange the key is for."
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
              placeholder="Harbor Bank Settlement"
            />
          </FormRow>
          <FormRow
            label="Email"
            error={show("email")}
            hint="Needed for Export for WKD and keyserver search."
          >
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-md"
              placeholder="settlement@harborbank.example"
            />
          </FormRow>
          <FormRow label="Comment">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="max-w-md"
            />
          </FormRow>
          <FormRow label="Additional user IDs">
            <div className="space-y-2">
              {extra.map((u, i) => (
                <div key={i} className="flex gap-2 max-w-xl">
                  <Input
                    placeholder="Name"
                    value={u.name}
                    onChange={(e) =>
                      setExtra((x) =>
                        x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)),
                      )
                    }
                  />
                  <Input
                    placeholder="Email"
                    value={u.email}
                    onChange={(e) =>
                      setExtra((x) =>
                        x.map((y, j) => (j === i ? { ...y, email: e.target.value } : y)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExtra((x) => x.filter((_, j) => j !== i))}
                    aria-label="Remove user ID"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExtra((x) => [...x, { name: "", email: "" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add user ID
              </Button>
            </div>
          </FormRow>
        </FormSection>

        <FormSection title="Key">
          <FormRow
            label="Algorithm"
            required
            error={show("algorithm")}
            hint={
              algorithm === "Ed25519"
                ? "Ed25519 for signing, Cv25519 for the encryption subkey."
                : "Only algorithms the policy allows are listed."
            }
          >
            <Select value={algorithm} onValueChange={setAlgorithm}>
              <SelectTrigger className="h-9 w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {algos.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow
            label="Primary key validity"
            required
            error={show("primary")}
            hint={
              primaryNoExpiry
                ? "The key will show the No Expiry risk."
                : Number.isFinite(pd) && pd > 0
                  ? `Expires ${fmtDate(rel(pd))}${policy.maxValidityPrimary ? `. Policy maximum ${policy.maxValidityPrimary} days.` : ""}`
                  : undefined
            }
          >
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                value={primaryDays}
                disabled={primaryNoExpiry}
                onChange={(e) => setPrimaryDays(e.target.value)}
                className="w-32"
              />
              <span className="text-[13px] text-muted-foreground">days</span>
              {!policy.expiryRequired && policy.maxValidityPrimary === null && (
                <label className="flex items-center gap-1.5 text-[13px] ml-3">
                  <Checkbox
                    checked={primaryNoExpiry}
                    onCheckedChange={(v) => setPrimaryNoExpiry(!!v)}
                  />{" "}
                  No expiry
                </label>
              )}
            </div>
          </FormRow>
          <FormRow
            label="Subkeys"
            hint="Required subkeys come from the policy and cannot be removed."
          >
            <div className="space-y-2">
              {PURPOSES.map((p) => {
                const req = policy.requiredSubkeys.includes(p);
                return (
                  <div key={p} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-[150px] text-[14px]">
                      <Checkbox
                        checked={subs[p].on}
                        disabled={req}
                        onCheckedChange={(v) =>
                          setSubs((x) => ({ ...x, [p]: { ...x[p], on: !!v } }))
                        }
                      />
                      {p}
                      {req && (
                        <Lock
                          className="h-3 w-3 text-muted-foreground"
                          aria-label="Required by policy"
                        />
                      )}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      disabled={!subs[p].on}
                      value={subs[p].days}
                      onChange={(e) =>
                        setSubs((x) => ({ ...x, [p]: { ...x[p], days: e.target.value } }))
                      }
                      className="w-28 h-8"
                    />
                    <span className="text-[13px] text-muted-foreground">days</span>
                    {req && (
                      <span className="text-[12px] text-muted-foreground">Required by policy</span>
                    )}
                    {show(`sub-${p}`) && (
                      <span className="text-[12px] text-risk-red">{show(`sub-${p}`)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </FormRow>
        </FormSection>

        <FormSection title="Protection">
          <FormRow label="Passphrase" required error={show("pass")}>
            <RadioGroup
              value={passMode}
              onValueChange={(v) => setPassMode(v as typeof passMode)}
              className="space-y-2"
            >
              <label className="flex items-center gap-2 text-[14px]">
                <RadioGroupItem value="Generated" /> Generate a strong passphrase and store it with
                the key
              </label>
              <label className="flex items-center gap-2 text-[14px]">
                <RadioGroupItem value="Entered" /> Enter a passphrase
              </label>
            </RadioGroup>
            {passMode === "Entered" && (
              <div className="flex gap-2 mt-2 max-w-md">
                <Input
                  type="password"
                  placeholder="Passphrase"
                  value={pass1}
                  onChange={(e) => setPass1(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Confirm passphrase"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                />
              </div>
            )}
          </FormRow>
          <FormRow
            label="Store in CyberArk"
            hint={
              policy.cyberArk?.required
                ? `${policy.name} requires keys in ${group} to be stored in CyberArk.`
                : "When off, the private key and passphrase are stored in AppViewX."
            }
          >
            <div className="flex items-center gap-2">
              <Toggle
                checked={cyberArk}
                onChange={setCyberArk}
                disabled={!!policy.cyberArk?.required || !policy.cyberArk}
                label="Store in CyberArk"
              />
              {policy.cyberArk?.required && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            {cyberArk && policy.cyberArk && (
              <div className="mt-3 grid grid-cols-2 gap-3 max-w-2xl rounded border border-border p-3">
                <VaultField label="Vault configuration" value={policy.cyberArk.vaultConfig} />
                <VaultField label="Safe name" value={policy.cyberArk.safeName} />
                <VaultField label="User name" value={policy.cyberArk.userName} />
                <div>
                  <div className="text-[12px] text-muted-foreground mb-1">PAM account name</div>
                  <Input
                    className="h-8"
                    value={pamName}
                    placeholder={pamDefault}
                    onChange={(e) => setPamName(e.target.value)}
                  />
                </div>
                <VaultField label="Server address" value={policy.cyberArk.serverAddress} />
                <div className="text-[12px] text-muted-foreground self-end">
                  From the key group's policy
                </div>
              </div>
            )}
          </FormRow>
          <FormRow label="Tags" hint="Separate tags with commas.">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="max-w-md"
              placeholder="settlement, partner-exchange"
            />
          </FormRow>
        </FormSection>

        <Note>
          AppViewX creates the key and its revocation certificate together. The key appears in Own
          Keys as Managed with Hosts shown as Not provisioned until you provision it.
        </Note>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" asChild>
            <Link to="/inventory/pgp" search={{ tab: "own" }}>
              Cancel
            </Link>
          </Button>
          <Button onClick={submit}>Generate</Button>
        </div>
      </div>
    </div>
  );
}

function VaultField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-muted-foreground mb-1">{label}</div>
      <div className="h-8 px-2 flex items-center rounded border border-border bg-muted/50 text-[13px]">
        {value}
      </div>
    </div>
  );
}
