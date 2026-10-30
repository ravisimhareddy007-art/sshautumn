import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  FormActions,
  FormCard,
  FormRow,
  FormSection,
  OnOff,
  PillSwitch,
  PrimaryButton,
  RadioGroupRow,
  SecondaryButton,
  SelectInput,
  TagInput,
  TextArea,
  TextInput,
} from "@/components/common/ProductForm";
import { blankPolicy, type KeyPolicy, type Purpose } from "@/data/pgp";
import { HYBRID_ALGOS } from "@/data/mock";
import { saveKeyPolicy, usePgp } from "@/lib/pgp-store";
import { OWN_RISKS } from "@/lib/pgp-rules";

const SSH_ALGORITHMS = [
  "ECDSA:256",
  "ECDSA:384",
  "ECDSA:521",
  "ED25519:256",
  "RSA:2048",
  "RSA:3072",
  "RSA:4096",
  "RSA:8192",
  ...HYBRID_ALGOS.map((a) => a.display),
];
const RISKS = [...new Set(["Shared", "Weak", "Rogue", "Misplaced", "Suspicious", ...OWN_RISKS])];
const PGP_ALGORITHMS = [
  "RSA:2048",
  "RSA:3072",
  "RSA:4096",
  "ED25519",
  "ECDSA:P-256",
  "ECDSA:P-384",
  "ECDSA:P-521",
];
const SUBKEYS: { value: Purpose; label: string }[] = [
  { value: "Encrypt", label: "Encryption" },
  { value: "Sign", label: "Signing" },
  { value: "Authenticate", label: "Authentication" },
];
const EXTENSIONS = [
  "permit-agent-forwarding",
  "permit-port-forwarding",
  "permit-pty",
  "permit-user-rc",
  "permit-X11-forwarding",
];
const VAULT_CONFIGS = ["CyberArk-Prod", "CyberArk-DR"];
const KEY_SIZES: Record<string, string[]> = {
  RSA: ["2048", "3072", "4096"],
  ECDSA: ["256", "384", "521"],
  ED25519: ["256"],
};

type Errors = Partial<Record<string, string>>;

function validate(p: KeyPolicy, all: KeyPolicy[]): Errors {
  const e: Errors = {};
  if (!p.name.trim()) e.name = "Enter a policy name";
  else if (all.some((x) => x.id !== p.id && x.name.toLowerCase() === p.name.trim().toLowerCase()))
    e.name = "A policy with this name already exists";
  if (!p.sshAlgorithms.length) e.sshAlgorithms = "Select at least one algorithm";
  if (p.age !== null && (!Number.isInteger(p.age) || p.age < 1))
    e.age = "Enter a whole number of days";
  for (const [k, label] of [
    ["safeName", "safe name"],
    ["userName", "user name"],
    ["pamAccountName", "PAM account name"],
    ["serverAddress", "server address"],
  ] as const)
    if (!p.storage[k].trim()) e[k] = `Enter the ${label}`;
  if (p.evaluatePgp) {
    if (!p.pgpAlgorithms.length) e.pgpAlgorithms = "Select at least one algorithm";
    const pm = p.maxValidityPrimaryMonths;
    const sm = p.maxValiditySubkeysMonths;
    if (
      pm === null ||
      !Number.isInteger(pm) ||
      pm < 1 ||
      sm === null ||
      !Number.isInteger(sm) ||
      sm < 1
    )
      e.maxValidity = "Enter whole months for both the primary key and subkeys";
    else if (sm > pm) e.maxValidity = "Subkeys cannot be valid longer than the primary key";
    if (!p.requiredSubkeys.length) e.requiredSubkeys = "Select at least one subkey";
  }
  if (p.certMaxValidity === null || !Number.isInteger(p.certMaxValidity) || p.certMaxValidity < 1)
    e.certMaxValidity = "Enter the maximum validity";
  return e;
}

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export function KeyPolicyFormPage({ policyId }: { policyId?: string }) {
  const s = usePgp();
  const navigate = useNavigate();
  const existing = policyId ? s.policies.find((p) => p.id === policyId) : undefined;
  const [p, setP] = useState<KeyPolicy>(() =>
    existing ? structuredClone(existing) : blankPolicy(),
  );
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<KeyPolicy>) => setP((x) => ({ ...x, ...patch }));
  const setStorage = (patch: Partial<KeyPolicy["storage"]>) =>
    setP((x) => ({ ...x, storage: { ...x.storage, ...patch } }));

  const errors = useMemo(() => validate(p, s.policies), [p, s.policies]);
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const repoKeys = s.trusted.filter((k) => k.type === "Repository");
  const repoLabel = (fp: string) =>
    p.approvedRepoKeys.find((r) => r.fingerprint === fp)?.label ??
    repoKeys.find((k) => k.primary.fingerprint === fp)?.label ??
    `${fp.slice(0, 4)}…${fp.slice(-4)}`;
  const pgpOff = !p.evaluatePgp;

  if (policyId && !existing) {
    return (
      <div>
        <PageHeader title="Edit" parents={[{ label: "Key Policy", to: "/policies/key" }]} />
        <FormCard>
          <p className="text-[15px]">This policy no longer exists.</p>
        </FormCard>
      </div>
    );
  }

  const submit = () => {
    setShowErrors(true);
    if (Object.keys(errors).length) {
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    const saved = saveKeyPolicy({ ...p, name: p.name.trim() });
    toast.success(
      existing ? `Key Policy "${saved.name}" updated.` : `Key Policy "${saved.name}" created.`,
    );
    navigate({ to: "/policies/key" });
  };

  return (
    <div>
      <PageHeader
        title={existing ? "Edit" : "Add"}
        parents={[{ label: "Key Policy", to: "/policies/key" }]}
      />
      <FormCard>
        <FormSection title="Policy details">
          <FormRow label="Policy Name" required error={err("name")}>
            <TextInput
              value={p.name}
              onChange={(v) => set({ name: v })}
              invalid={!!err("name")}
              ariaLabel="Policy Name"
            />
          </FormRow>
          <FormRow label="Description">
            <TextArea
              value={p.description}
              onChange={(v) => set({ description: v })}
              ariaLabel="Description"
            />
          </FormRow>
        </FormSection>

        <FormSection title="Compliance Configuration">
          <FormRow label="Key Algorithm And Size" required error={err("sshAlgorithms")}>
            <TagInput
              values={p.sshAlgorithms}
              options={SSH_ALGORITHMS}
              onChange={(v) => set({ sshAlgorithms: v })}
              invalid={!!err("sshAlgorithms")}
              ariaLabel="Key Algorithm And Size"
            />
          </FormRow>
          <FormRow label="Allowed Risks">
            <TagInput
              values={p.allowedRisks}
              options={RISKS}
              onChange={(v) => set({ allowedRisks: v })}
              placeholder="Select allowed risks"
              ariaLabel="Allowed Risks"
            />
          </FormRow>
          <FormRow
            label="Age"
            error={err("age")}
            hint="The compliance status of the key will be determined based on the provided age. If no age is given, it will be excluded from the compliance calculation."
          >
            <TextInput
              type="number"
              value={p.age === null ? "" : String(p.age)}
              onChange={(v) => set({ age: num(v) })}
              ariaLabel="Age"
            />
          </FormRow>
        </FormSection>

        <FormSection title="Private Key Storage">
          <FormRow
            label="Vault Storage"
            required
            hint={
              p.storage.mode === "Optional"
                ? "Optional: Create Key offers a Store in CyberArk toggle, off by default."
                : "Required: every key created under this policy is stored in CyberArk."
            }
          >
            <RadioGroupRow
              name="Vault Storage"
              value={p.storage.mode}
              onChange={(v) => setStorage({ mode: v })}
              options={[
                { value: "Optional", label: "Optional" },
                { value: "Required", label: "Required: CyberArk" },
              ]}
            />
          </FormRow>
          <FormRow label="Vault Config" required>
            <SelectInput
              value={p.storage.vaultConfig}
              onChange={(v) => setStorage({ vaultConfig: v })}
              options={VAULT_CONFIGS}
              ariaLabel="Vault Config"
            />
          </FormRow>
          <FormRow label="Safe Name" required error={err("safeName")}>
            <TextInput
              value={p.storage.safeName}
              onChange={(v) => setStorage({ safeName: v })}
              invalid={!!err("safeName")}
              ariaLabel="Safe Name"
            />
          </FormRow>
          <FormRow label="User Name" required error={err("userName")}>
            <TextInput
              value={p.storage.userName}
              onChange={(v) => setStorage({ userName: v })}
              invalid={!!err("userName")}
              ariaLabel="User Name"
            />
          </FormRow>
          <FormRow label="PAM Account Name" required error={err("pamAccountName")}>
            <TextInput
              value={p.storage.pamAccountName}
              onChange={(v) => setStorage({ pamAccountName: v })}
              invalid={!!err("pamAccountName")}
              ariaLabel="PAM Account Name"
            />
          </FormRow>
          <FormRow label="Server Address" required error={err("serverAddress")}>
            <TextInput
              value={p.storage.serverAddress}
              onChange={(v) => setStorage({ serverAddress: v })}
              invalid={!!err("serverAddress")}
              ariaLabel="Server Address"
            />
          </FormRow>
          <FormRow label="Allow Override" required>
            <PillSwitch
              value={p.storage.allowOverride}
              onChange={(v) => setStorage({ allowOverride: v })}
              label="Allow Override"
            />
          </FormRow>
        </FormSection>

        <FormSection title="PGP Key Configuration">
          <FormRow
            label="Evaluate PGP Keys"
            hint={
              p.evaluatePgp
                ? "PGP keys in this policy's groups are checked for compliance."
                : "Starts off, so nothing is flagged until the team is ready."
            }
          >
            <OnOff
              value={p.evaluatePgp}
              onChange={(v) => set({ evaluatePgp: v })}
              label="Evaluate PGP Keys"
            />
          </FormRow>
          <FormRow
            label="Allowed Algorithms"
            required
            disabled={pgpOff}
            error={err("pgpAlgorithms")}
          >
            <TagInput
              values={p.pgpAlgorithms}
              options={PGP_ALGORITHMS}
              onChange={(v) => set({ pgpAlgorithms: v })}
              disabled={pgpOff}
              invalid={!!err("pgpAlgorithms")}
              ariaLabel="Allowed Algorithms"
            />
          </FormRow>
          <FormRow
            label="Maximum Validity"
            required
            disabled={pgpOff}
            error={err("maxValidity")}
            hint={`Primary keys up to ${p.maxValidityPrimaryMonths ?? "?"} months; subkeys up to ${p.maxValiditySubkeysMonths ?? "?"}.`}
          >
            <div
              className={
                pgpOff
                  ? "rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-3 opacity-60"
                  : "rounded-md border border-[#E5E7EB] p-3"
              }
            >
              <MonthsRow
                label="Primary"
                value={p.maxValidityPrimaryMonths}
                onChange={(v) => set({ maxValidityPrimaryMonths: v })}
                disabled={pgpOff}
              />
              <MonthsRow
                label="Subkeys"
                value={p.maxValiditySubkeysMonths}
                onChange={(v) => set({ maxValiditySubkeysMonths: v })}
                disabled={pgpOff}
                className="mt-3"
              />
            </div>
          </FormRow>
          <FormRow label="Expiry Required" disabled={pgpOff}>
            <OnOff
              value={p.expiryRequired}
              onChange={(v) => set({ expiryRequired: v })}
              disabled={pgpOff}
              label="Expiry Required"
            />
          </FormRow>
          <FormRow label="Revocation Certificate Required" disabled={pgpOff}>
            <OnOff
              value={p.revCertRequired}
              onChange={(v) => set({ revCertRequired: v })}
              disabled={pgpOff}
              label="Revocation Certificate Required"
            />
          </FormRow>
          <FormRow
            label="Required Subkeys"
            required
            disabled={pgpOff}
            error={err("requiredSubkeys")}
            hint={
              p.requiredSubkeys.length
                ? `${joinLabels(p.requiredSubkeys)} ${p.requiredSubkeys.length > 1 ? "are" : "is"} required, so every new key has ${p.requiredSubkeys.length > 1 ? "them" : "it"}.`
                : undefined
            }
          >
            <TagInput
              values={p.requiredSubkeys}
              options={SUBKEYS.map((x) => x.value)}
              render={(v) => SUBKEYS.find((x) => x.value === v)?.label ?? v}
              onChange={(v) => set({ requiredSubkeys: v as Purpose[] })}
              disabled={pgpOff}
              invalid={!!err("requiredSubkeys")}
              ariaLabel="Required Subkeys"
            />
          </FormRow>
        </FormSection>

        <FormSection title="Trusted Key Settings">
          <FormRow
            label="Require Approval"
            hint={
              p.requireApproval
                ? "Partner keys need approval before they can be distributed."
                : "Imported partner keys are approved on import."
            }
          >
            <OnOff
              value={p.requireApproval}
              onChange={(v) => set({ requireApproval: v })}
              label="Require Approval"
            />
          </FormRow>
          <FormRow label="Approved Repository Keys" hint="Only listed repository keys are trusted.">
            <TagInput
              values={p.approvedRepoKeys.map((r) => r.fingerprint)}
              options={[
                ...new Set([
                  ...repoKeys.map((k) => k.primary.fingerprint),
                  ...p.approvedRepoKeys.map((r) => r.fingerprint),
                ]),
              ]}
              render={repoLabel}
              onChange={(fps) =>
                set({
                  approvedRepoKeys: fps.map((fp) => ({ fingerprint: fp, label: repoLabel(fp) })),
                })
              }
              placeholder="Select repository keys"
              ariaLabel="Approved Repository Keys"
            />
          </FormRow>
        </FormSection>

        <FormSection title="SSH Certificate Configuration">
          <FormRow label="Max Validity" required error={err("certMaxValidity")}>
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                type="number"
                value={p.certMaxValidity === null ? "" : String(p.certMaxValidity)}
                onChange={(v) => set({ certMaxValidity: num(v) })}
                invalid={!!err("certMaxValidity")}
                ariaLabel="Max Validity"
              />
              <SelectInput
                value={p.certMaxValidityUnit}
                onChange={(v) =>
                  set({ certMaxValidityUnit: v as KeyPolicy["certMaxValidityUnit"] })
                }
                options={["Day(s)", "Week(s)", "Month(s)"]}
                ariaLabel="Max Validity unit"
              />
            </div>
          </FormRow>
          <FormRow label="Extensions">
            <TagInput
              values={p.extensions}
              options={EXTENSIONS}
              onChange={(v) => set({ extensions: v })}
              ariaLabel="Extensions"
            />
          </FormRow>
          <FormRow
            label="Critical Options"
            info="Adds force-command and source-address restrictions to certificates issued under this policy."
          >
            <PillSwitch
              value={p.criticalOptions}
              onChange={(v) => set({ criticalOptions: v })}
              label="Critical Options"
            />
          </FormRow>
        </FormSection>

        <FormSection title="Rotation Configuration">
          <FormRow label="Rotate Automatically">
            <PillSwitch
              value={p.rotateAutomatically}
              onChange={(v) => set({ rotateAutomatically: v })}
              label="Rotate Automatically"
            />
          </FormRow>
          <FormRow label="Key Algorithm" required>
            <SelectInput
              value={p.rotationKeyAlgorithm}
              onChange={(v) => set({ rotationKeyAlgorithm: v, rotationKeySize: KEY_SIZES[v][0] })}
              options={Object.keys(KEY_SIZES)}
              ariaLabel="Key Algorithm"
            />
          </FormRow>
          <FormRow label="Key Size" required>
            <SelectInput
              value={p.rotationKeySize}
              onChange={(v) => set({ rotationKeySize: v })}
              options={KEY_SIZES[p.rotationKeyAlgorithm] ?? []}
              ariaLabel="Key Size"
            />
          </FormRow>
          <FormRow label="Post-Window Action">
            <RadioGroupRow
              name="Post-Window Action"
              value={p.postWindowAction}
              onChange={(v) => set({ postWindowAction: v })}
              options={[
                { value: "Manual Confirmation", label: "Manual Confirmation" },
                { value: "Auto-Deactivate", label: "Auto-Deactivate" },
              ]}
            />
          </FormRow>
        </FormSection>

        <FormSection title="Host Certificate Auto Rotate Settings" className="mb-6">
          <FormRow label="Auto Rotate Host Certificates Before" required>
            <SelectInput
              value={p.hostCertAutoRotateBefore}
              onChange={(v) => set({ hostCertAutoRotateBefore: v })}
              options={["10 Days", "30 Days", "60 Days"]}
              ariaLabel="Auto Rotate Host Certificates Before"
            />
          </FormRow>
        </FormSection>

        <FormActions>
          <PrimaryButton onClick={submit}>{existing ? "Update" : "Create"}</PrimaryButton>
          <SecondaryButton onClick={() => navigate({ to: "/policies/key" })}>
            Cancel
          </SecondaryButton>
        </FormActions>
      </FormCard>
    </div>
  );
}

function joinLabels(list: Purpose[]) {
  const names = list.map((v) => SUBKEYS.find((x) => x.value === v)?.label ?? v);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
    : names[0];
}

function MonthsRow({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span className="w-[72px] text-[15px] text-[#4B5563]">{label}</span>
      <input
        type="number"
        min={1}
        aria-label={`${label} maximum validity in months`}
        disabled={disabled}
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(num(e.target.value))}
        className="h-10 w-[104px] rounded-md border border-[#D1D5DB] bg-white px-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-[#F9FAFB]"
      />
      <span className="text-[15px] text-[#4B5563]">Month(s)</span>
    </div>
  );
}
