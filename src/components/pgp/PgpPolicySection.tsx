import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { GROUP_POLICY, type Curve, type PgpPolicy, type Purpose } from "@/data/pgp";
import { algoAllowed, compliance, OWN_RISKS } from "@/lib/pgp-rules";
import { algoForPurpose, savePolicy, usePgp } from "@/lib/pgp-store";
import { ChipToggle, FormRow, Toggle } from "./pgp-form";

export interface PgpPolicyHandle {
  /** Returns true when the PGP settings can be saved. Shows errors otherwise. */
  validate: () => boolean;
  save: () => string;
  reset: () => void;
}

const ROTATION_ALGOS = [
  "Ed25519",
  "RSA 3072",
  "RSA 4096",
  "ECDSA P-256",
  "ECDSA P-384",
  "ECDSA P-521",
];
const CURVES: Curve[] = ["P-256", "P-384", "P-521"];
const PURPOSES: Purpose[] = ["Encrypt", "Sign", "Authenticate"];

export function validatePgpPolicy(p: PgpPolicy): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.rsaMin === null && !p.ed25519 && p.ecdsaCurves.length === 0)
    e.algos = "Allow at least one algorithm";
  const rot = algoForPurpose(p.rotationAlgorithm, "Sign");
  if (!algoAllowed(rot, p))
    e.rotationAlgorithm = `${p.rotationAlgorithm} is not in the allowed algorithms`;
  if (!Number.isFinite(p.expiringThreshold) || p.expiringThreshold < 1 || p.expiringThreshold > 365)
    e.threshold = "Enter 1 to 365 days";
  else if (p.maxValiditySubkeys !== null && p.expiringThreshold >= p.maxValiditySubkeys)
    e.threshold = `Must be shorter than the subkey maximum (${p.maxValiditySubkeys} days)`;
  if (p.maxValidityPrimary !== null && p.maxValidityPrimary < 1)
    e.maxPrimary = "Enter a positive number of days or leave blank";
  if (p.maxValiditySubkeys !== null && p.maxValiditySubkeys < 1)
    e.maxSub = "Enter a positive number of days or leave blank";
  if (!Number.isFinite(p.rotationValidity) || p.rotationValidity < 1)
    e.rotationValidity = "Enter the number of days";
  else if (p.maxValiditySubkeys !== null && p.rotationValidity > p.maxValiditySubkeys)
    e.rotationValidity = `Must not exceed the subkey maximum (${p.maxValiditySubkeys} days)`;
  const seen = new Set<string>();
  p.approvedRepoKeys.forEach((r, i) => {
    const fp = r.fingerprint.replace(/\s+/g, "").toUpperCase();
    if (!/^[0-9A-F]{40}$/.test(fp)) e[`repo-${i}`] = "A fingerprint is 40 hexadecimal characters";
    else if (seen.has(fp)) e[`repo-${i}`] = "This fingerprint is already listed";
    seen.add(fp);
  });
  return e;
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export const PgpPolicySection = forwardRef<PgpPolicyHandle>(function PgpPolicySection(_props, ref) {
  const s = usePgp();
  const [policyId, setPolicyId] = useState("pol-default");
  const stored = s.policies.find((p) => p.id === policyId)!;
  const [draft, setDraft] = useState<PgpPolicy>(stored);
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    setDraft(s.policies.find((p) => p.id === policyId)!);
    setShowErrors(false);
  }, [policyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<PgpPolicy>) => setDraft((d) => ({ ...d, ...patch }));
  const errors = validatePgpPolicy(draft);
  const err = (k: string) => (showErrors ? errors[k] : undefined);

  useImperativeHandle(
    ref,
    () => ({
      validate: () => {
        setShowErrors(true);
        return Object.keys(validatePgpPolicy(draft)).length === 0;
      },
      save: () => {
        savePolicy({
          ...draft,
          approvedRepoKeys: draft.approvedRepoKeys.map((r) => ({
            ...r,
            fingerprint: r.fingerprint.replace(/\s+/g, "").toUpperCase(),
          })),
        });
        return draft.name;
      },
      reset: () => {
        setDraft(s.policies.find((p) => p.id === policyId)!);
        setShowErrors(false);
      },
    }),
    [draft, s.policies, policyId],
  );

  const groups = Object.entries(GROUP_POLICY)
    .filter(([, id]) => id === policyId)
    .map(([g]) => g);
  const inScope = s.own.filter((k) => groups.includes(k.group));
  const preview = inScope.map((k) => compliance(k, draft));
  const nonCompliant = preview.filter((c) => c.state === "Non-Compliant").length;

  return (
    <div className="p-6" data-testid="pgp-policy">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">
          PGP Key Configuration
        </h2>
        <Badge className="text-[9px] bg-primary text-white px-1.5">NEW</Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Policy</span>
          <Select value={policyId} onValueChange={setPolicyId}>
            <SelectTrigger className="h-8 w-[200px] text-[12px]" aria-label="PGP policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {s.policies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mb-2">
        Applies to own and trusted PGP keys in {groups.join(", ")}.{" "}
        {draft.evaluate ? (
          <span>
            With these settings {inScope.length - nonCompliant} of {inScope.length} own keys are
            compliant.
          </span>
        ) : (
          <span>Compliance is not evaluated.</span>
        )}
      </div>

      <FormRow
        label="Evaluate PGP Keys"
        hint="When off, own keys show Not evaluated. Risks are still shown."
      >
        <Toggle
          checked={draft.evaluate}
          onChange={(v) => set({ evaluate: v })}
          label="Evaluate PGP Keys"
        />
      </FormRow>

      <FormRow
        label="Allowed Algorithms"
        required
        error={err("algos")}
        hint="Ed25519 also covers Cv25519 encryption subkeys. ECDSA also covers ECDH on the same curve."
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] w-[70px]">RSA</span>
            <Select
              value={draft.rsaMin === null ? "none" : String(draft.rsaMin)}
              onValueChange={(v) =>
                set({ rsaMin: v === "none" ? null : (Number(v) as 2048 | 3072 | 4096) })
              }
            >
              <SelectTrigger className="h-8 w-[180px] text-[12px]" aria-label="RSA minimum">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not allowed</SelectItem>
                <SelectItem value="2048">2048 bits or more</SelectItem>
                <SelectItem value="3072">3072 bits or more</SelectItem>
                <SelectItem value="4096">4096 bits or more</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-[12px]">
            <span className="w-[70px]">Ed25519</span>
            <Checkbox checked={draft.ed25519} onCheckedChange={(v) => set({ ed25519: !!v })} />{" "}
            Allowed
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] w-[70px]">ECDSA</span>
            {CURVES.map((c) => (
              <ChipToggle
                key={c}
                on={draft.ecdsaCurves.includes(c)}
                onClick={() =>
                  set({
                    ecdsaCurves: draft.ecdsaCurves.includes(c)
                      ? draft.ecdsaCurves.filter((x) => x !== c)
                      : [...draft.ecdsaCurves, c],
                  })
                }
              >
                {c}
              </ChipToggle>
            ))}
          </div>
        </div>
      </FormRow>

      <FormRow
        label="Max Validity, Primary Key"
        error={err("maxPrimary")}
        hint="Days, measured from when the expiry was last set. Leave blank for no limit."
      >
        <DaysInput
          value={draft.maxValidityPrimary}
          onChange={(v) => set({ maxValidityPrimary: v })}
          label="Max validity primary"
        />
      </FormRow>
      <FormRow
        label="Max Validity, Subkeys"
        error={err("maxSub")}
        hint="Days, measured from when the expiry was last set. Leave blank for no limit."
      >
        <DaysInput
          value={draft.maxValiditySubkeys}
          onChange={(v) => set({ maxValiditySubkeys: v })}
          label="Max validity subkeys"
        />
      </FormRow>
      <FormRow
        label="Expiring Threshold"
        required
        error={err("threshold")}
        hint="A key shows Expiring when its next expiry is within this many days."
      >
        <DaysInput
          value={draft.expiringThreshold}
          onChange={(v) => set({ expiringThreshold: v ?? NaN })}
          label="Expiring threshold"
        />
      </FormRow>
      <FormRow
        label="Expiry Required"
        hint="A primary key without an expiry date is Non-Compliant."
      >
        <Toggle
          checked={draft.expiryRequired}
          onChange={(v) => set({ expiryRequired: v })}
          label="Expiry Required"
        />
      </FormRow>
      <FormRow
        label="Revocation Certificate Required"
        hint="An own key without a stored revocation certificate is Non-Compliant."
      >
        <Toggle
          checked={draft.revCertRequired}
          onChange={(v) => set({ revCertRequired: v })}
          label="Revocation Certificate Required"
        />
      </FormRow>
      <FormRow
        label="Required Subkeys for New Keys"
        hint="Generate PGP Key always adds these subkeys and does not let the user remove them."
      >
        <div className="flex gap-2">
          {PURPOSES.map((p) => (
            <ChipToggle
              key={p}
              on={draft.requiredSubkeys.includes(p)}
              onClick={() =>
                set({
                  requiredSubkeys: draft.requiredSubkeys.includes(p)
                    ? draft.requiredSubkeys.filter((x) => x !== p)
                    : [...draft.requiredSubkeys, p],
                })
              }
            >
              {p}
            </ChipToggle>
          ))}
        </div>
      </FormRow>
      <FormRow
        label="Rotation Algorithm"
        required
        error={err("rotationAlgorithm")}
        hint="Used for the new subkey created by Rotate Subkey."
      >
        <Select
          value={draft.rotationAlgorithm}
          onValueChange={(v) => set({ rotationAlgorithm: v })}
        >
          <SelectTrigger className="h-8 w-[200px] text-[12px]" aria-label="Rotation algorithm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROTATION_ALGOS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow
        label="Rotation Validity"
        required
        error={err("rotationValidity")}
        hint="Days the new subkey is valid for."
      >
        <DaysInput
          value={draft.rotationValidity}
          onChange={(v) => set({ rotationValidity: v ?? NaN })}
          label="Rotation validity"
        />
      </FormRow>
      <FormRow
        label="Allowed Risks"
        hint="Risks listed here do not make an own key Non-Compliant. None by default."
      >
        <div className="flex flex-wrap gap-2 max-w-2xl">
          {OWN_RISKS.map((r) => (
            <ChipToggle
              key={r}
              on={draft.allowedRisks.includes(r)}
              onClick={() =>
                set({
                  allowedRisks: draft.allowedRisks.includes(r)
                    ? draft.allowedRisks.filter((x) => x !== r)
                    : [...draft.allowedRisks, r],
                })
              }
            >
              {r}
            </ChipToggle>
          ))}
        </div>
      </FormRow>
      <FormRow
        label="Require Approval for Partner Keys"
        hint={
          draft.requireApproval
            ? "A second person must approve an imported partner key before it can be distributed. The importer cannot approve."
            : 'Imported partner keys are approved on import and show "Not required by policy".'
        }
      >
        <Toggle
          checked={draft.requireApproval}
          onChange={(v) => set({ requireApproval: v })}
          label="Require Approval for Partner Keys"
        />
      </FormRow>
      <FormRow
        label="Approved Repository Keys"
        hint="Repository signing keys not on this list show the Untrusted repository risk."
      >
        <div className="space-y-2 max-w-3xl">
          {draft.approvedRepoKeys.map((r, i) => (
            <div key={i}>
              <div className="flex gap-2">
                <Input
                  className="h-8 font-mono text-[11px] flex-[2]"
                  placeholder="40-character fingerprint"
                  value={r.fingerprint}
                  onChange={(e) =>
                    set({
                      approvedRepoKeys: draft.approvedRepoKeys.map((x, j) =>
                        j === i ? { ...x, fingerprint: e.target.value } : x,
                      ),
                    })
                  }
                  aria-label={`Fingerprint ${i + 1}`}
                />
                <Input
                  className="h-8 text-[12px] flex-1"
                  placeholder="Label"
                  value={r.label}
                  onChange={(e) =>
                    set({
                      approvedRepoKeys: draft.approvedRepoKeys.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set({ approvedRepoKeys: draft.approvedRepoKeys.filter((_, j) => j !== i) })
                  }
                  aria-label="Remove repository key"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {err(`repo-${i}`) && (
                <div className="text-[11px] text-risk-red mt-1">{err(`repo-${i}`)}</div>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              set({ approvedRepoKeys: [...draft.approvedRepoKeys, { fingerprint: "", label: "" }] })
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add repository key
          </Button>
        </div>
      </FormRow>
      {draft.cyberArk && (
        <FormRow
          label="CyberArk for PGP Keys"
          hint="Vault used when a PGP key in these groups is stored in CyberArk. When required, Generate PGP Key locks Store in CyberArk on."
        >
          <div className="space-y-2 max-w-2xl">
            <label className="flex items-center gap-2 text-[12px]">
              <Toggle
                checked={draft.cyberArk.required}
                onChange={(v) => set({ cyberArk: { ...draft.cyberArk!, required: v } })}
                label="Require CyberArk"
              />{" "}
              Require CyberArk storage
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["vaultConfig", "Vault configuration"],
                  ["safeName", "Safe name"],
                  ["userName", "User name"],
                  ["pamFormat", "PAM account name format"],
                  ["serverAddress", "Server address"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
                  <Input
                    className="h-8 text-[12px]"
                    value={draft.cyberArk![key]}
                    onChange={(e) =>
                      set({ cyberArk: { ...draft.cyberArk!, [key]: e.target.value } })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </FormRow>
      )}
      {stored !== draft && Object.keys(errors).length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          Unsaved PGP changes. Click Update to save.
        </div>
      )}
    </div>
  );
});

function DaysInput({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        aria-label={label}
        className="w-[120px] h-8 text-[13px]"
        value={value === null || Number.isNaN(value) ? "" : String(value)}
        onChange={(e) => onChange(numOrNull(e.target.value))}
      />
      <span className="text-[12px] text-muted-foreground">days</span>
    </div>
  );
}
