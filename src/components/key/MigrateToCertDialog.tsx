import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SshKey } from "@/data/mock";
import { CAS } from "@/data/mock";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Shield, Info } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type EligibilityPath = "migrate" | "rotate" | "migrate_hold" | "blocked";

interface Eligibility {
  path: EligibilityPath;
  reason: string;
  checks: { label: string; detail: string; pass: boolean }[];
}

interface AuthOption {
  raw: string;
  certField: string;
  certValue: string;
  type: "critical" | "extension_deny";
  label: string;
  description: string;
}

// ─── Eligibility computation ─────────────────────────────────────────────────

function computeEligibility(k: SshKey): Eligibility {
  const base = [
    { label: "Managed status", detail: "Key is managed by AVX", pass: true },
    { label: "Option string captured", detail: "authorized_keys restrictions discovered during scan", pass: true },
    { label: "Key Policy", detail: "Default_Key_Policy — certificate support enabled, CA mapped", pass: true },
    {
      label: "Host cert-readiness",
      detail: `TrustedUserCAKeys configured on ${k.hostEndpoints[0] ?? "target host"}`,
      pass: k.hostEndpoints.length > 0,
    },
  ];

  if (k.migrationStatus && k.migrationStatus !== "rolled_back")
    return {
      path: "blocked",
      reason: `This key is already ${k.migrationStatus === "in_coexistence" ? "in a coexistence window" : k.migrationStatus === "awaiting_confirmation" ? "awaiting decommission confirmation" : k.migrationStatus === "decommissioned" ? "fully migrated" : "in an unknown migration state"}. Use the Actions menu to manage the existing migration.`,
      checks: [
        ...base,
        { label: "Migration state", detail: `Already ${k.migrationStatus.replace(/_/g, " ")}`, pass: false },
      ],
    };

  if (k.riskStatus === "Shared")
    return {
      path: "blocked",
      reason:
        "Shared key: the same public key is used by multiple user accounts. Migrating would require naming all principals in one certificate, so a single revocation would lock everyone out. Decompose into per-user keys first.",
      checks: [...base, { label: "Risk classification", detail: "SHARED — used by more than one user", pass: false }],
    };

  if (k.riskStatus === "Rogue")
    return {
      path: "blocked",
      reason:
        "Rogue key: file ownership does not match the associated user. Migration would cement this mismatch into the certificate. Resolve the ownership issue first.",
      checks: [
        ...base,
        { label: "Risk classification", detail: "ROGUE — file ownership mismatch detected", pass: false },
      ],
    };

  if (k.riskStatus === "Misplaced")
    return {
      path: "blocked",
      reason:
        "Misplaced key: key file is not in the expected path for the associated user. Fix the file location before migrating.",
      checks: [
        ...base,
        { label: "Risk classification", detail: "MISPLACED — key file in unexpected location", pass: false },
      ],
    };

  if (k.riskStatus === "Weak")
    return {
      path: "rotate",
      reason:
        "Weak key: signing a weak key only produces a certified weak key — the cryptographic vulnerability survives. A new strong keypair will be generated first, and the certificate issued on the new key.",
      checks: [
        ...base,
        { label: "Risk classification", detail: "WEAK — algorithm or length below policy threshold", pass: false },
        { label: "Rotate path selected", detail: "New compliant keypair will be generated before signing", pass: true },
      ],
    };

  if (k.riskStatus === "Suspicious" || k.combination === "public_only")
    return {
      path: "migrate_hold",
      reason:
        "Suspicious key: the public key was found in authorized_keys, but the private key was not located during discovery. The certificate can be issued, but the original key entry will be held — not removed — until an administrator confirms decommission.",
      checks: [
        ...base,
        { label: "Risk classification", detail: "SUSPICIOUS — private key not found in discovery", pass: false },
        {
          label: "Decommission hold",
          detail: "Post-window action forced to Manual Confirmation regardless of policy",
          pass: true,
        },
      ],
    };

  if (k.hostEndpoints.length === 0)
    return {
      path: "blocked",
      reason:
        "No host endpoint is associated with this key. Migration requires a target host where the authorized_keys entry exists and CA trust will be established.",
      checks: [
        ...base.slice(0, 3),
        { label: "Host cert-readiness", detail: "No host endpoint found — cannot target a host", pass: false },
      ],
    };

  return {
    path: "migrate",
    reason:
      "Clean, managed key with a single associated user, no risk flags, and private key located. Will sign the existing public key directly — no new key material generated.",
    checks: [
      ...base,
      { label: "Risk classification", detail: "NONE — no risk flags", pass: true },
      { label: "Single associated user", detail: k.associatedUsers[0] ?? "—", pass: k.associatedUsers.length <= 1 },
      { label: "Private key located", detail: "Both public and private halves found in discovery", pass: true },
    ],
  };
}

const PATH_META: Record<EligibilityPath, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  migrate: {
    label: "Migrate — sign existing key",
    badgeClass: "bg-risk-green/10 text-risk-green border-risk-green/30",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  rotate: {
    label: "Rotate → then migrate",
    badgeClass: "bg-risk-amber/10 text-risk-amber border-risk-amber/30",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  migrate_hold: {
    label: "Migrate — decommission held",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    icon: <Info className="h-4 w-4" />,
  },
  blocked: {
    label: "Blocked — remediation required",
    badgeClass: "bg-risk-red/10 text-risk-red border-risk-red/30",
    icon: <XCircle className="h-4 w-4" />,
  },
};

// Sample authorized_keys options for the permission translation mock
const SAMPLE_OPTIONS: AuthOption[] = [
  {
    raw: `from="10.0.0.0/8"`,
    certField: "source-address",
    certValue: "10.0.0.0/8",
    type: "critical",
    label: "Source IP restriction",
    description:
      "Only connections from 10.0.0.0/8 are accepted. Enforced as a Critical Option — the SSH server rejects the certificate entirely if it cannot honour this restriction. Fail closed.",
  },
  {
    raw: `command="/usr/bin/backup"`,
    certField: "force-command",
    certValue: "/usr/bin/backup",
    type: "critical",
    label: "Forced command",
    description:
      "Regardless of what the client requests, the server always and only runs /usr/bin/backup. The user cannot open a shell or run any other command.",
  },
  {
    raw: "no-pty",
    certField: "permit-pty",
    certValue: "OMITTED",
    type: "extension_deny",
    label: "No interactive terminal",
    description:
      "PTY allocation is not permitted. In the certificate, permit-pty is simply not added to the Extensions field.",
  },
  {
    raw: "no-port-forwarding",
    certField: "permit-port-forwarding",
    certValue: "OMITTED",
    type: "extension_deny",
    label: "No port forwarding",
    description: "SSH tunneling is not permitted. permit-port-forwarding is absent from the certificate Extensions.",
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Eligibility", "Permissions", "Certificate", "Confirm"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                i < step
                  ? "bg-risk-green text-white"
                  : i === step
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-[10px] whitespace-nowrap",
                i === step ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={cn("flex-1 h-[2px] mb-4 mx-1 transition-colors", i < step ? "bg-risk-green" : "bg-border")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 0: Eligibility ──────────────────────────────────────────────────────

function EligibilityStep({ k, eligibility }: { k: SshKey; eligibility: Eligibility }) {
  const meta = PATH_META[eligibility.path];
  const blocked = eligibility.path === "blocked";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 bg-muted/40 rounded-md border border-border text-[12px]">
        {[
          ["Key", k.name],
          ["Algorithm", `${k.encryption} / ${k.length}`],
          ["Fingerprint", k.fingerprint.slice(0, 22) + "…"],
          ["Associated user", k.associatedUsers[0] ?? "—"],
          ["Host", k.hostEndpoints[0] ?? "—"],
          ["Key Policy", "Default_Key_Policy"],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="text-muted-foreground shrink-0 w-32">{label}</span>
            <span className="font-medium truncate">{value}</span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-md border",
          blocked
            ? "bg-risk-red/5 border-risk-red/30"
            : eligibility.path === "rotate"
              ? "bg-risk-amber/5 border-risk-amber/30"
              : eligibility.path === "migrate_hold"
                ? "bg-primary/5 border-primary/20"
                : "bg-risk-green/5 border-risk-green/30",
        )}
      >
        <span
          className={cn(
            meta.badgeClass,
            "flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0 mt-0.5",
          )}
        >
          {meta.icon}
          {meta.label}
        </span>
        <p className="text-[12px] text-foreground leading-relaxed">{eligibility.reason}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Eligibility checks</p>
        <div className="space-y-1.5">
          {eligibility.checks.map((c) => (
            <div
              key={c.label}
              className={cn(
                "flex items-start gap-2 p-2 rounded text-[12px] border",
                c.pass ? "bg-risk-green/5 border-risk-green/20" : "bg-risk-red/5 border-risk-red/20",
              )}
            >
              {c.pass ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-risk-green shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-risk-red shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-medium">{c.label}: </span>
                <span className="text-muted-foreground">{c.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Permission Translation ──────────────────────────────────────────

function PermissionStep({
  highlighted,
  onHighlight,
}: {
  highlighted: string | null;
  onHighlight: (k: string | null) => void;
}) {
  const h = highlighted ? SAMPLE_OPTIONS.find((o) => o.raw === highlighted) : null;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        Every restriction in the authorized_keys line must be faithfully carried into the certificate. The certificate
        is built <span className="font-medium text-foreground">clear-then-add</span>: starting from zero permissions so
        a missed translation fails closed rather than open. Hover over each option to inspect the translation.
      </p>

      {/* Transformation card */}
      <div className="grid grid-cols-[1fr_28px_1fr] rounded-md overflow-hidden border border-border text-[12px] font-mono">
        <div className="bg-[#0B1220] p-3 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-[#4A5A7A] mb-2 font-sans">authorized_keys line</p>
          {SAMPLE_OPTIONS.map((o) => (
            <span
              key={o.raw}
              onMouseEnter={() => onHighlight(o.raw)}
              onMouseLeave={() => onHighlight(null)}
              className={cn(
                "block cursor-pointer rounded px-1 transition-colors leading-6",
                highlighted === o.raw
                  ? o.type === "critical"
                    ? "text-risk-red bg-risk-red/10"
                    : "text-risk-amber bg-risk-amber/10"
                  : "text-[#7A8FAD]",
              )}
            >
              {o.raw}
              {o !== SAMPLE_OPTIONS[SAMPLE_OPTIONS.length - 1] && ","}
            </span>
          ))}
          <span className="text-[#3A4A6A] leading-6">ssh-ed25519 AAAA…xyz user@host</span>
        </div>
        <div className="bg-[#080E18] flex flex-col items-center justify-center gap-0.5 py-3">
          {SAMPLE_OPTIONS.map((o) => (
            <ArrowRight
              key={o.raw}
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                highlighted === o.raw
                  ? o.type === "critical"
                    ? "text-risk-red"
                    : "text-risk-amber"
                  : "text-[#2A3A5A]",
              )}
            />
          ))}
          <div className="h-6" />
        </div>
        <div className="bg-[#061410] p-3 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-[#2A5A4A] mb-2 font-sans">certificate fields</p>
          {SAMPLE_OPTIONS.map((o) => (
            <div
              key={o.raw}
              onMouseEnter={() => onHighlight(o.raw)}
              onMouseLeave={() => onHighlight(null)}
              className={cn(
                "block cursor-pointer rounded px-1 transition-colors leading-6",
                highlighted === o.raw
                  ? o.type === "critical"
                    ? "text-risk-red bg-risk-red/10"
                    : "text-risk-amber bg-risk-amber/10"
                  : o.type === "extension_deny"
                    ? "text-[#2A5A4A]"
                    : "text-[#7A8FAD]",
              )}
            >
              {o.type === "critical" ? (
                <>
                  <span className="text-risk-red/60">[critical] </span>
                  {o.certField}={o.certValue}
                </>
              ) : (
                <span>{o.certField}: OMITTED ✕</span>
              )}
            </div>
          ))}
          <div className="text-[#1A3A2A] leading-6">permit-agent-forwarding: OMITTED ✕</div>
        </div>
      </div>

      {h && (
        <div
          className={cn(
            "flex items-start gap-3 p-3 rounded-md border text-[12px]",
            h.type === "critical" ? "bg-risk-red/5 border-risk-red/30" : "bg-risk-amber/5 border-risk-amber/30",
          )}
        >
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px]",
              h.type === "critical"
                ? "text-risk-red border-risk-red/40 bg-risk-red/10"
                : "text-risk-amber border-risk-amber/40 bg-risk-amber/10",
            )}
          >
            {h.type === "critical" ? "CRITICAL OPTION" : "EXTENSION (absent)"}
          </Badge>
          <div>
            <p className="font-semibold mb-0.5">{h.label}</p>
            <p className="text-muted-foreground leading-relaxed">{h.description}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6 p-2.5 bg-muted/40 rounded-md border border-border text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-risk-red" />
          <span>
            <span className="font-medium">Critical Option</span> — fail closed if unrecognised
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-risk-amber" />
          <span>
            <span className="font-medium">Extension absent</span> — permission not granted
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 bg-risk-green/5 border border-risk-green/20 rounded-md text-[12px] text-risk-green">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        All 4 restrictions successfully mapped. Certificate will be built clear-then-add.
      </div>
    </div>
  );
}

// ─── Step 2: Certificate Preview ──────────────────────────────────────────────

function CertPreviewStep({ k }: { k: SshKey }) {
  const ca = CAS[0];
  const validTo = new Date();
  validTo.setDate(validTo.getDate() + 90);
  const validToStr = validTo.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-[12px] text-primary leading-relaxed">
        <Shield className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
        <span className="font-medium">Policy-driven:</span> CA, max validity, extensions, and critical options are
        inherited from <span className="font-medium">Default_Key_Policy</span>. These fields are read-only — not
        configured during provisioning.
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Certificate Authority", value: ca.name, src: "from policy" },
          { label: "Max Validity", value: "90 days (policy ceiling)", src: "from policy" },
          {
            label: "Principal",
            value: k.associatedUsers[0] ?? "(none — review required)",
            src: "from key association",
          },
          { label: "Valid from", value: today, src: "today" },
          { label: "Valid to", value: validToStr, src: "computed" },
          {
            label: "Key ID",
            value: `avx|src:${k.fingerprint.slice(7, 15)}|host:${k.hostEndpoints[0] ?? "—"}|pol:Default`,
            src: "stamped at issuance",
          },
        ].map(({ label, value, src }) => (
          <div key={label} className="p-2.5 bg-muted/40 rounded-md border border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {src}
              </Badge>
            </div>
            <p className="text-[12px] font-medium break-all">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Coexistence settings (from Default_Key_Policy)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/40 rounded-md border border-border">
            <p className="text-[10px] text-muted-foreground mb-1">Coexistence Duration</p>
            <p className="text-[18px] font-bold">14 days</p>
            <p className="text-[11px] text-muted-foreground mt-1">Both key + cert remain active after issuance</p>
          </div>
          <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
            <p className="text-[10px] text-muted-foreground mb-1">Post-Window Action</p>
            <p className="text-[14px] font-bold text-primary">Manual Confirmation</p>
            <p className="text-[11px] text-muted-foreground mt-1">Admin must approve key removal after window closes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({ k, confirmed, onConfirm }: { k: SshKey; confirmed: boolean; onConfirm: (v: boolean) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-0 text-[12px] divide-y divide-border border border-border rounded-md overflow-hidden">
        {[
          ["Certificate will be issued for", `${k.name} on ${k.hostEndpoints[0] ?? "target host"}`],
          ["Signing", "Existing public key — no new key material generated"],
          ["CA (from policy)", CAS[0].name],
          ["Restrictions preserved", "force-command, source-address, no permit-pty, no permit-port-forwarding"],
          ["Certificate validity", "90 days from today"],
          ["Coexistence window", "14 days — both credentials remain active"],
          ["Removal method", "Manual Confirmation — admin notified on day 14"],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-3 px-3 py-2.5">
            <span className="text-muted-foreground shrink-0 w-44">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>

      <div className="p-3 bg-risk-amber/5 border border-risk-amber/30 rounded-md text-[12px] leading-relaxed">
        <AlertTriangle className="inline h-3.5 w-3.5 text-risk-amber mr-1.5 -mt-0.5" />
        <span className="font-medium text-risk-amber">Important:</span> The original authorized_keys entry will remain
        active for 14 days. It will only be removed after you confirm decommission in the inventory. This is the Manual
        Confirmation path.
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(v) => onConfirm(!!v)} />
        <span className="text-[13px]">
          I understand that the original key will remain active during the coexistence window and that decommission
          requires manual confirmation.
        </span>
      </label>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function MigrateToCertDialog({
  ssKey,
  onClose,
  onMigrated,
}: {
  ssKey: SshKey | null;
  onClose: () => void;
  onMigrated: (
    id: string,
    data: {
      migrationIssuedAt: string;
      migrationWindowDays: number;
      migrationPostWindowAction: "manual" | "auto";
      migrationHostEndpoint?: string;
      migrationCertId?: string;
    },
  ) => void;
}) {
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  if (!ssKey) return null;

  const eligibility = computeEligibility(ssKey);
  const isBlocked = eligibility.path === "blocked";

  const canNext = step === 0 ? !isBlocked : step === 3 ? confirmed : true;

  const reset = () => {
    setStep(0);
    setConfirmed(false);
    setHighlighted(null);
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    // Complete migration
    const today = new Date().toISOString().slice(0, 10);
    onMigrated(ssKey.id, {
      migrationIssuedAt: today,
      migrationWindowDays: 14,
      migrationPostWindowAction: "manual",
      migrationHostEndpoint: ssKey.hostEndpoints[0],
      migrationCertId: undefined, // In production this would be the issued cert ID
    });
    toast.success(
      `Migration initiated for "${ssKey.name}". Certificate issued. 14-day coexistence window started. You will be notified when confirmation is required.`,
      { duration: 6000 },
    );
    reset();
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={!!ssKey} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle>Migrate to Certificate</DialogTitle>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {ssKey.name} · {ssKey.encryption} · {ssKey.hostEndpoints[0] ?? "no host endpoint"}
          </p>
        </DialogHeader>

        <StepIndicator step={step} />

        {step === 0 && <EligibilityStep k={ssKey} eligibility={eligibility} />}
        {step === 1 && <PermissionStep highlighted={highlighted} onHighlight={setHighlighted} />}
        {step === 2 && <CertPreviewStep k={ssKey} />}
        {step === 3 && <ConfirmStep k={ssKey} confirmed={confirmed} onConfirm={setConfirmed} />}

        <DialogFooter>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleNext} disabled={!canNext}>
            {isBlocked && step === 0 ? "Close" : step === 3 ? "Confirm & Migrate" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
