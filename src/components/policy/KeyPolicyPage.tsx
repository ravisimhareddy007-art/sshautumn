import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Info, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { CAS } from "@/data/mock";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyState {
  name: string;
  description: string;
  keyAlgorithms: string[];
  allowedRisks: string[];
  age: string;
  maxValidity: string;
  maxValidityUnit: "Day(s)" | "Month(s)";
  extensions: string[];
  criticalOptions: boolean;
  caId: string;
  coexistenceDays: string;
  postWindowAction: "manual" | "auto";
  rotateAutomatically: boolean;
  rotationAlgo: string;
  rotationKeySize: string;
  autoRotateBefore: string;
}

// Single list of supported key algorithms. Adding a future algorithm means
// adding one entry here; the policy screen and evaluator read from this list.
type AlgoDef = {
  display: string;      // shown in the UI
  canonical: string;    // stored and sent over the API
  family: "Classical" | "Hybrid post-quantum";
  tooltip: string;
};

const ALGO_DEFS: AlgoDef[] = [
  { display: "ECDSA:256",   canonical: "ECDSA:256",   family: "Classical", tooltip: "ECDSA with a 256-bit curve." },
  { display: "ECDSA:384",   canonical: "ECDSA:384",   family: "Classical", tooltip: "ECDSA with a 384-bit curve." },
  { display: "ECDSA:521",   canonical: "ECDSA:521",   family: "Classical", tooltip: "ECDSA with a 521-bit curve." },
  { display: "ED25519:256", canonical: "ED25519:256", family: "Classical", tooltip: "Ed25519." },
  { display: "RSA:2048",    canonical: "RSA:2048",    family: "Classical", tooltip: "RSA with a 2048-bit key." },
  { display: "RSA:3072",    canonical: "RSA:3072",    family: "Classical", tooltip: "RSA with a 3072-bit key." },
  { display: "RSA:4096",    canonical: "RSA:4096",    family: "Classical", tooltip: "RSA with a 4096-bit key." },
  { display: "RSA:8192",    canonical: "RSA:8192",    family: "Classical", tooltip: "RSA with an 8192-bit key." },
  {
    display: "MLDSA44-ED25519",
    canonical: "ssh-mldsa44-ed25519",
    family: "Hybrid post-quantum",
    tooltip: "ML-DSA-44 combined with Ed25519 in a single key. Both signatures must verify to log in. Usable on OpenSSH 10.4 and above.",
  },
  {
    display: "MLDSA87-P384",
    canonical: "ssh-mldsa87-p384",
    family: "Hybrid post-quantum",
    tooltip: "ML-DSA-87 combined with ECDSA P-384 in a single key. Not yet available in any OpenSSH version; can be allowed in policy ahead of time.",
  },
];

const ALL_ALGOS = ALGO_DEFS.map((a) => a.display);
const algoDef = (display: string) => ALGO_DEFS.find((a) => a.display === display);
const isHybrid = (display: string) => algoDef(display)?.family === "Hybrid post-quantum";
const ALGO_GROUPS = [
  { label: "Classical", options: ALGO_DEFS.filter((a) => a.family === "Classical").map((a) => a.display) },
  { label: "Hybrid post-quantum", options: ALGO_DEFS.filter((a) => a.family === "Hybrid post-quantum").map((a) => a.display) },
];

const ALL_EXTENSIONS = [
  "permit-agent-forwarding", "permit-port-forwarding",
  "permit-pty", "permit-user-rc", "permit-X11-forwarding",
];

const RISK_OPTIONS = ["None", "Shared", "Weak", "Rogue", "Misplaced", "Suspicious"];

const DEFAULT_POLICY: PolicyState = {
  name: "Default_Key_Policy",
  description: "Default policy for SSH Keys",
  keyAlgorithms: ["ECDSA:256", "ECDSA:384", "ECDSA:521", "ED25519:256", "RSA:2048", "RSA:3072", "RSA:4096", "RSA:8192"],
  allowedRisks: [],
  age: "90",
  maxValidity: "12",
  maxValidityUnit: "Month(s)",
  extensions: ["permit-agent-forwarding", "permit-port-forwarding", "permit-pty", "permit-user-rc", "permit-X11-forwarding"],
  criticalOptions: true,
  caId: "ca1",
  coexistenceDays: "14",
  postWindowAction: "manual",
  rotateAutomatically: false,
  rotationAlgo: "ECDSA",
  rotationKeySize: "256",
  autoRotateBefore: "10 Days",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, isNew }: { title: string; isNew?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">{title}</h2>
      {isNew && (
        <Badge className="text-[9px] bg-primary text-white px-1.5">NEW</Badge>
      )}
    </div>
  );
}

function FieldRow({
  label,
  required,
  children,
  hint,
  isNew,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  isNew?: boolean;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-6 py-3 items-start">
      <div className="flex items-center gap-1 pt-2">
        {required && <span className="text-destructive text-[13px]">*</span>}
        <Label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
          {label}
          {isNew && (
            <Badge className="text-[9px] bg-primary text-white px-1.5">NEW</Badge>
          )}
        </Label>
      </div>
      <div>
        {children}
        {hint && <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">{hint}</p>}
      </div>
    </div>
  );
}

function TagInput({
  values,
  options,
  placeholder,
  onChange,
  groups,
  tooltip,
  tag,
}: {
  values: string[];
  options: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
  groups?: { label: string; options: string[] }[];
  tooltip?: (v: string) => string | undefined;
  tag?: (v: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const remaining = options.filter((o) => !values.includes(o));
  const renderOption = (r: string) => (
    <button
      key={r}
      type="button"
      title={tooltip?.(r)}
      className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted flex items-center justify-between gap-2"
      onClick={() => { onChange([...values, r]); setOpen(false); }}
    >
      <span>{r}</span>
      {tag?.(r) && (
        <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1 rounded shrink-0">
          {tag(r)}
        </span>
      )}
    </button>
  );

  return (
    <div
      className="relative flex flex-wrap items-center gap-1.5 min-h-[36px] p-1.5 border border-border rounded-md bg-muted/30 cursor-text"
      onClick={() => setOpen(true)}
    >
      {values.map((v) => (
        <span key={v} title={tooltip?.(v)} className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-[11px] px-2 py-0.5 rounded">
          {v}
          {tag?.(v) && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/15 px-1 rounded">
              {tag(v)}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)); }}
            className="hover:bg-primary/20 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {remaining.length > 0 && open && (
        <div className="absolute z-10 top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-md min-w-[250px] max-h-[280px] overflow-y-auto">
          {groups
            ? groups.map((g) => {
                const opts = g.options.filter((o) => remaining.includes(o));
                if (opts.length === 0) return null;
                return (
                  <div key={g.label}>
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-t border-border first:border-t-0">
                      {g.label}
                    </div>
                    {opts.map(renderOption)}
                  </div>
                );
              })
            : remaining.map(renderOption)}
        </div>
      )}
      {!open && remaining.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5"
        >
          <Plus className="h-3 w-3" />
          {placeholder ?? "Add"}
        </button>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn("w-10 h-6 rounded-full relative transition-colors", checked ? "bg-primary" : "bg-muted")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function KeyPolicyPage() {
  const [policy, setPolicy] = useState<PolicyState>(DEFAULT_POLICY);
  const set = (patch: Partial<PolicyState>) => setPolicy((p) => ({ ...p, ...patch }));

  const handleSave = () => {
    toast.success(`Key Policy "${policy.name}" updated successfully.`);
  };

  return (
    <div>
      <PageHeader breadcrumbs={["POLICIES", "Key Policy"]} title="Key Policy" />

      <div className="bg-surface border border-border rounded-md overflow-hidden divide-y divide-border">
        {/* Info banner */}
        <div className="flex items-start gap-2 px-6 py-3 bg-primary/5 border-b border-primary/20">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[12px] text-foreground leading-relaxed">
            Fields marked <Badge className="text-[9px] bg-primary text-white px-1.5 mx-0.5 align-middle">NEW</Badge>
            are new for the Autumn release and support SSH Key → Certificate Migration.
          </p>
        </div>

        {/* ── Policy Details ─────────────────────────────────────────── */}
        <div className="p-6">
          <SectionHeader title="Policy Details" />
          <div>
            <FieldRow label="Name" required>
              <Input
                value={policy.name}
                onChange={(e) => set({ name: e.target.value })}
                className="max-w-xs text-[13px]"
              />
            </FieldRow>
            <FieldRow label="Description">
              <textarea
                value={policy.description}
                onChange={(e) => set({ description: e.target.value })}
                className="w-full max-w-xl text-[13px] border border-border rounded-md p-2 bg-muted/30 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
              />
            </FieldRow>
          </div>
        </div>

        {/* ── Compliance Configuration ───────────────────────────────── */}
        <div className="p-6">
          <SectionHeader title="Compliance Configuration" />
          <div>
            <FieldRow label="Key Algorithm And Size" required>
              <TagInput
                values={policy.keyAlgorithms}
                options={ALL_ALGOS}
                placeholder="Add algorithm"
                onChange={(v) => set({ keyAlgorithms: v })}
                groups={ALGO_GROUPS}
                tooltip={(v) => algoDef(v)?.tooltip}
                tag={(v) => (isHybrid(v) ? "Hybrid PQC" : null)}
              />
              <AlgorithmSummary selected={policy.keyAlgorithms} />
            </FieldRow>
            <FieldRow label="Allowed Risks">
              <TagInput
                values={policy.allowedRisks}
                options={RISK_OPTIONS}
                placeholder="Select allowed risks"
                onChange={(v) => set({ allowedRisks: v })}
              />
            </FieldRow>
            <FieldRow
              label="Age"
              hint="The compliance status of the key will be determined based on the provided age. If no age is given, it will be excluded from the compliance calculation."
            >
              <Input
                type="number"
                value={policy.age}
                onChange={(e) => set({ age: e.target.value })}
                className="max-w-[100px] text-[13px]"
              />
            </FieldRow>
          </div>
        </div>

        {/* ── SSH Certificate Configuration ─────────────────────────── */}
        <div className="p-6">
          <SectionHeader title="SSH Certificate Configuration" />
          <div>
            <FieldRow label="Max Validity" required>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={policy.maxValidity}
                  onChange={(e) => set({ maxValidity: e.target.value })}
                  className="max-w-[100px] text-[13px]"
                />
                <Select
                  value={policy.maxValidityUnit}
                  onValueChange={(v) => set({ maxValidityUnit: v as PolicyState["maxValidityUnit"] })}
                >
                  <SelectTrigger className="w-[130px] text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Day(s)">Day(s)</SelectItem>
                    <SelectItem value="Month(s)">Month(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldRow>

            <FieldRow label="Extensions">
              <TagInput
                values={policy.extensions}
                options={ALL_EXTENSIONS}
                placeholder="Add extension"
                onChange={(v) => set({ extensions: v })}
              />
            </FieldRow>

            <FieldRow label="Critical Options">
              <div className="flex items-center gap-3">
                <Toggle checked={policy.criticalOptions} onChange={(v) => set({ criticalOptions: v })} />
                <span className="text-[12px] text-muted-foreground">{policy.criticalOptions ? "On — from= and command= restrictions enforced at server" : "Off"}</span>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </FieldRow>

            {/* ── NEW: Migration Settings sub-section ── */}
            <div className="mt-6 pt-5 border-t border-dashed border-primary/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-primary">Migration Settings</span>
                <Badge className="text-[9px] bg-primary text-white px-1.5">NEW</Badge>
                <span className="text-[11px] text-muted-foreground">— used when migrating keys to certificates</span>
              </div>

              <FieldRow
                label="Certificate Authority"
                required
                isNew
                hint="The CA that signs migration certificates. Read at migration time from this policy — not selected during provisioning. Required when migration is initiated."
              >
                <Select value={policy.caId} onValueChange={(v) => set({ caId: v })}>
                  <SelectTrigger className="max-w-xs text-[13px] border-primary bg-primary/5">
                    <SelectValue placeholder="Select CA" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAS.map((ca) => (
                      <SelectItem key={ca.id} value={ca.id}>
                        {ca.name} — expires {ca.expiry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow
                label="Coexistence Duration"
                isNew
                hint="Days both the original key entry and the new certificate remain active simultaneously after migration. Snapshotted at migration time — changing this does not affect in-flight migrations."
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={policy.coexistenceDays}
                    onChange={(e) => set({ coexistenceDays: e.target.value })}
                    className="max-w-[100px] text-[13px] border-primary bg-primary/5"
                    min="1"
                    max="90"
                  />
                  <span className="text-[12px] text-muted-foreground">days</span>
                  <div className="flex gap-4 ml-2 text-[11px] text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded">Dev: 7 days</span>
                    <span className="bg-muted px-2 py-0.5 rounded">Prod: 14–30 days</span>
                  </div>
                </div>
              </FieldRow>

              <FieldRow
                label="Post-Window Action"
                isNew
                hint="What happens when the coexistence window closes. Suspicious keys always follow Manual Confirmation regardless of this setting."
              >
                <div className="space-y-2.5">
                  <label
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors",
                      policy.postWindowAction === "manual"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="postWindowAction"
                      checked={policy.postWindowAction === "manual"}
                      onChange={() => set({ postWindowAction: "manual" })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">Manual Confirmation</div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        The original key entry is held after the window closes. An administrator must explicitly confirm decommission in Key Inventory.
                        Admin is notified before the window closes. Suitable for regulated environments.
                      </div>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors",
                      policy.postWindowAction === "auto"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="postWindowAction"
                      checked={policy.postWindowAction === "auto"}
                      onChange={() => set({ postWindowAction: "auto" })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">Auto-Deactivate</div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        The original authorized_keys entry is removed automatically when the coexistence window expires.
                        Admin is notified before the window closes. Suitable for teams with strong observability.
                      </div>
                    </div>
                  </label>

                  <div className="flex items-start gap-2 p-2.5 bg-risk-amber/5 border border-risk-amber/30 rounded-md text-[11px] text-risk-amber leading-relaxed">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>
                      <strong>Suspicious keys</strong> always follow Manual Confirmation regardless of this setting.
                      Keys with the <strong>neverDecommission</strong> flag also override Auto-Deactivate.
                    </span>
                  </div>
                </div>
              </FieldRow>
            </div>
          </div>
        </div>

        {/* ── Rotation Configuration ─────────────────────────────────── */}
        <div className="p-6">
          <SectionHeader title="Rotation Configuration" />
          <div>
            <FieldRow label="Rotate Automatically">
              <Toggle checked={policy.rotateAutomatically} onChange={(v) => set({ rotateAutomatically: v })} />
            </FieldRow>
            <FieldRow label="Key Algorithm" required>
              <Select value={policy.rotationAlgo} onValueChange={(v) => set({ rotationAlgo: v })}>
                <SelectTrigger className="max-w-[200px] text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ECDSA">ECDSA</SelectItem>
                  <SelectItem value="ED25519">ED25519</SelectItem>
                  <SelectItem value="RSA">RSA</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Key Size" required>
              <Select value={policy.rotationKeySize} onValueChange={(v) => set({ rotationKeySize: v })}>
                <SelectTrigger className="max-w-[200px] text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="256">256</SelectItem>
                  <SelectItem value="384">384</SelectItem>
                  <SelectItem value="521">521</SelectItem>
                  <SelectItem value="2048">2048</SelectItem>
                  <SelectItem value="4096">4096</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>

        {/* ── Host Certificate Auto Rotate Settings ──────────────────── */}
        <div className="p-6">
          <SectionHeader title="Host Certificate Auto Rotate Settings" />
          <div>
            <FieldRow label="Auto Rotate Host Certificates Before" required>
              <Select value={policy.autoRotateBefore} onValueChange={(v) => set({ autoRotateBefore: v })}>
                <SelectTrigger className="max-w-[200px] text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10 Days">10 Days</SelectItem>
                  <SelectItem value="30 Days">30 Days</SelectItem>
                  <SelectItem value="60 Days">60 Days</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>

        {/* ── Action bar ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setPolicy(DEFAULT_POLICY)}>Cancel</Button>
          <Button onClick={handleSave}>Update</Button>
        </div>
      </div>
    </div>
  );
}

/** Plain-language line under the algorithm field describing what the selection means. */
function AlgorithmSummary({ selected }: { selected: string[] }) {
  if (selected.length === 0) return null;
  const hybrid = selected.filter(isHybrid).length;
  const classical = selected.length - hybrid;

  let text: string;
  if (hybrid > 0 && classical === 0) {
    text = "Hybrid post-quantum only. Keys using a classical algorithm are Non-Compliant with the reason \u201cAlgorithm does not meet PQC policy requirement\u201d.";
  } else if (hybrid > 0) {
    text = "Classical and hybrid post-quantum both allowed. Keys of either kind are Compliant while the estate moves across.";
  } else {
    text = "Classical only. No hybrid post-quantum algorithm is allowed under this policy.";
  }


  return (
    <div className="mt-2">
      <div className="text-[12px] text-muted-foreground">{text}</div>
    </div>
  );
}
