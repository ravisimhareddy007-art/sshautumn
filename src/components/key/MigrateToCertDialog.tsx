import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SshKey } from "@/data/mock";
import { CAS } from "@/data/mock";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Shield,
  Info,
} from "lucide-react";

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
  type: "critical" | "extension_deny" | "extension_allow";
  label: string;
  description: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeEligibility(k: SshKey): Eligibility {
  const base = [
    { label: "Managed status", detail: "Key is managed by AVX", pass: true },
    { label: "Option string captured", detail: "authorized_keys restrictions discovered during scan", pass: true },
    { label: "Key Policy", detail: "Default_Key_Policy — certificate support enabled, CA mapped", pass: true },
    { label: "Host cert-readiness", detail: `TrustedUserCAKeys configured on ${k.hostEndpoints[0] ?? "target host"}`, pass: k.hostEndpoints.length > 0 },
  ];

  if (k.riskStatus === "Shared")
    return {
      path: "blocked",
      reason: "Shared key: the same public key is used by multiple user accounts. Migrating would require naming all principals in one certificate, so a single revocation would lock everyone out. Decompose into per-user keys first.",
      checks: [...base, { label: "Risk classification", detail: "SHARED — used by more than one user", pass: false }],
    };

  if (k.riskStatus === "Rogue")
    return {
      path: "blocked",
      reason: "Rogue key: file ownership does not match the associated user. Migration would cement this mismatch into the certificate. Resolve the ownership issue first.",
      checks: [...base, { label: "Risk classification", detail: "ROGUE — file ownership mismatch detected", pass: false }],
    };

  if (k.riskStatus === "Misplaced")
    return {
      path: "blocked",
      reason: "Misplaced key: key file is not in the expected path for the associated user. Fix the file location before migrating.",
      checks: [...base, { label: "Risk classification", detail: "MISPLACED — key file in unexpected location", pass: false }],
    };

  if (k.riskStatus === "Weak")
    return {
      path: "rotate",
      reason: "Weak key: signing a weak key only produces a certified weak key — the cryptographic vulnerability survives. A new strong keypair will be generated first, and the certificate issued on the new key.",
      checks: [
        ...base,
        { label: "Risk classification", detail: "WEAK — algorithm or length below policy threshold", pass: false },
        { label: "Rotate path selected", detail: "New compliant keypair will be generated before signing", pass: true },
      ],
    };

  if (k.riskStatus === "Suspicious" || k.combination === "public_only")
    return {
      path: "migrate_hold",
      reason: "Suspicious key: the public key was found in authorized_keys, but the private key was not located during discovery. The certificate can be issued, but the original key entry will be held — not removed — until an administrator confirms decommission.",
      checks: [
        ...base,
        { label: "Risk classification", detail: "SUSPICIOUS — private key not found in discovery", pass: false },
        { label: "Decommission hold", detail: "Post-window action forced to Manual Confirmation regardless of policy", pass: true },
      ],
    };

  return {
    path: "migrate",
    reason: "Clean, managed key with a single associated user, no risk flags, and private key located. Will sign the existing public key directly — no new key material generated.",
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
    icon: <Shield className="h-4 w-4" />,
  },
  blocked: {
    label: "Blocked — remediation required",
    badgeClass: "bg-risk-red/10 text-risk-red border-risk-red/30",
    icon: <XCircle className="h-4 w-4" />,
  },
};

const SAMPLE_OPTIONS: AuthOption[] = [
  {
    raw: `from="10.0.0.0/8"`,
    certField: "source-address",
    certValue: "10.0.0.0/8",
    type: "critical",
    label: "Source IP restriction",
    description:
      "Only SSH connections from 10.0.0.0/8 are accepted. Enforced as a Critical Option — the SSH server rejects the certificate entirely if it cannot honour this restriction.",
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
      "Interactive terminal (PTY) allocation is not permitted. In the certificate, permit-pty is simply not added to the Extensions field.",
  },
  {
    raw: "no-port-forwarding",
    certField: "permit-port-forwarding",
    certValue: "OMITTED",
    type: "extension_deny",
    label: "No port forwarding",
    description:
      "SSH tunneling is not permitted. permit-port-forwarding is absent from the certificate Extensions.",
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Eligibility", "Permissions", "Certificate", "Confirm"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 py-3 border-b border-border mb-4">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium border",
                i < step && "bg-primary text-primary-foreground border-primary",
                i === step && "bg-primary/10 text-primary border-primary",
                i > step && "bg-muted text-muted-foreground border-border",
              )}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-[12px]",
                i === step ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className="flex-1 h-px bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 0: Eligibility ──────────────────────────────────────────────────────

function EligibilityStep({ k, eligibility }: { k: SshKey; eligibility: Eligibility }) {
  const meta = PATH_META[eligibility.path];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded border border-border">
        {[
          ["Key", k.name],
          ["Algorithm", `${k.encryption} / ${k.length}`],
          ["Fingerprint", k.fingerprint.slice(0, 22) + "…"],
          ["Associated user", k.associatedUsers[0] ?? "—"],
          ["Host", k.hostEndpoints[0] ?? "—"],
          ["Key Policy", "Default_Key_Policy"],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-[12px] font-mono mt-0.5 truncate" title={value}>{value}</div>
          </div>
        ))}
      </div>

      <div className={cn("p-3 rounded border", meta.badgeClass)}>
        <div className="flex items-center gap-2 font-medium text-[13px]">
          {meta.icon}
          {meta.label}
        </div>
        <p className="text-[12px] mt-2 leading-relaxed">{eligibility.reason}</p>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Eligibility checks
        </div>
        <div className="space-y-1.5">
          {eligibility.checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2 text-[12px]">
              {c.pass ? (
                <CheckCircle2 className="h-4 w-4 text-risk-green shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-risk-red shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-medium">{c.label}:</span>{" "}
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
        Every restriction in the <code className="text-[11px] px-1 bg-muted rounded">authorized_keys</code> line
        must be faithfully carried into the certificate. Hover over each option to inspect the translation.
        The certificate is built <span className="font-medium text-foreground">clear-then-add</span> — starting
        from zero permissions so a missed translation fails closed rather than open.
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        {/* Left: authorized_keys */}
        <div className="p-3 rounded border border-border bg-muted/20 font-mono text-[11px]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-sans">
            authorized_keys line
          </div>
          {SAMPLE_OPTIONS.map((o, idx) => (
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
                  : "text-muted-foreground",
              )}
            >
              {o.raw}
              {idx < SAMPLE_OPTIONS.length - 1 && ","}
            </span>
          ))}
          <span className="block text-muted-foreground leading-6 mt-1">
            ssh-ed25519 AAAA…xyz user@host
          </span>
        </div>

        {/* Arrows */}
        <div className="flex flex-col justify-around py-6">
          {SAMPLE_OPTIONS.map((o) => (
            <ArrowRight
              key={o.raw}
              className={cn(
                "h-4 w-4",
                highlighted === o.raw ? "text-primary" : "text-muted-foreground/40",
              )}
            />
          ))}
        </div>

        {/* Right: certificate */}
        <div className="p-3 rounded border border-border bg-muted/20 font-mono text-[11px]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-sans">
            certificate fields
          </div>
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
                  : o.type === "extension_deny"
                    ? "text-muted-foreground/70"
                    : "text-muted-foreground",
              )}
            >
              {o.type === "critical" ? (
                <>
                  <span className="text-risk-red">[critical]</span>{" "}
                  {o.certField}={o.certValue}
                </>
              ) : (
                <>
                  {o.certField}: <span className="text-risk-red">OMITTED ✕</span>
                </>
              )}
            </span>
          ))}
          <span className="block text-muted-foreground leading-6 mt-1">
            permit-agent-forwarding: <span className="text-risk-red">OMITTED ✕</span>
          </span>
        </div>
      </div>

      {h && (
        <div className="p-3 rounded border border-primary/30 bg-primary/5">
          <Badge variant="outline" className={cn("text-[10px]", h.type === "critical" ? "bg-risk-red/10 text-risk-red border-risk-red/30" : "bg-risk-amber/10 text-risk-amber border-risk-amber/30")}>
            {h.type === "critical" ? "CRITICAL OPTION" : "EXTENSION (absent)"}
          </Badge>
          <div className="mt-2">
            <div className="text-[12px] font-medium">{h.label}</div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{h.description}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-risk-red" />
          <span>Critical Option — server rejects cert if unrecognised (fail closed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-risk-amber" />
          <span>Extension absent — permission not granted</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[12px] text-risk-green">
        <CheckCircle2 className="h-4 w-4" />
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

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded border border-primary/30 bg-primary/5 text-[12px]">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-medium">Policy-driven:</span> CA, max validity, extensions, and critical options
          are inherited from <span className="font-mono">Default_Key_Policy</span>. These fields are read-only —
          not set during provisioning.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Certificate Authority", value: ca.name, src: "from policy" },
          { label: "Max Validity", value: "90 days (policy ceiling)", src: "from policy" },
          { label: "Principal", value: k.associatedUsers[0] ?? "(none — set in wizard)", src: "from key association" },
          { label: "Valid from", value: new Date().toISOString().slice(0, 10), src: "today" },
          { label: "Valid to", value: validToStr, src: "computed" },
          {
            label: "Key ID",
            value: `avx|src:${k.fingerprint.slice(7, 15)}|host:${k.hostEndpoints[0] ?? "—"}|pol:Default`,
            src: "stamped at issuance",
          },
        ].map(({ label, value, src }) => (
          <div key={label} className="p-2 rounded border border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
              <span className="text-[9px] text-muted-foreground italic">{src}</span>
            </div>
            <div className="text-[12px] font-mono mt-1 truncate" title={value}>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Coexistence settings (from Default_Key_Policy)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded border border-border bg-muted/20">
            <div className="text-[11px] font-medium">Coexistence Duration</div>
            <div className="text-[14px] font-mono mt-1">14 days</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Both key + cert remain active after issuance
            </div>
          </div>
          <div className="p-3 rounded border border-border bg-muted/20">
            <div className="text-[11px] font-medium">Post-Window Action</div>
            <div className="text-[14px] font-mono mt-1">Manual Confirmation</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Admin must approve key removal after window closes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({
  k,
  confirmed,
  onConfirm,
}: {
  k: SshKey;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-border divide-y divide-border">
        {[
          ["Certificate will be issued for", `${k.name} on ${k.hostEndpoints[0] ?? "target host"}`],
          ["Signing", "Existing ED25519 public key — no new key material generated"],
          ["CA (from policy)", CAS[0].name],
          ["Restrictions preserved", "force-command, source-address, no permit-pty, no permit-port-forwarding"],
          ["Certificate validity", "90 days from today"],
          ["Coexistence window", "14 days — both credentials remain active"],
          ["Removal method", "Manual Confirmation — admin will be notified on day 14"],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[220px_1fr] gap-3 p-2 text-[12px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 p-3 rounded border border-risk-amber/30 bg-risk-amber/5 text-[12px]">
        <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
        <div>
          <span className="font-medium">Important:</span> The original authorized_keys entry will remain active
          for 14 days. It will only be removed after you confirm decommission in the inventory. This is the{" "}
          <span className="font-medium">Manual Confirmation</span> path.
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="migrate-confirm"
          checked={confirmed}
          onCheckedChange={(v) => onConfirm(!!v)}
        />
        <Label htmlFor="migrate-confirm" className="text-[12px] leading-relaxed cursor-pointer">
          I understand that the original key will remain active during the coexistence window and that
          decommission requires manual confirmation.
        </Label>
      </div>
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
  onMigrated: (id: string) => void;
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
    } else {
      onMigrated(ssKey.id);
      toast.success(
        `Migration initiated for "${ssKey.name}". Certificate issued. Coexistence window: 14 days.`,
        { duration: 5000 },
      );
      onClose();
      reset();
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      reset();
    }
  };

  return (
    <Dialog open={!!ssKey} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Migrate to Certificate</DialogTitle>
          <div className="text-[12px] text-muted-foreground font-mono">
            {ssKey.name} · {ssKey.encryption} · {ssKey.hostEndpoints[0] ?? "no host endpoint"}
          </div>
        </DialogHeader>

        <StepIndicator step={step} />

        {step === 0 && <EligibilityStep k={ssKey} eligibility={eligibility} />}
        {step === 1 && <PermissionStep highlighted={highlighted} onHighlight={setHighlighted} />}
        {step === 2 && <CertPreviewStep k={ssKey} />}
        {step === 3 && <ConfirmStep k={ssKey} confirmed={confirmed} onConfirm={setConfirmed} />}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>
            Cancel
          </Button>
          <Button onClick={handleNext} disabled={!canNext}>
            {isBlocked && step === 0
              ? "Close (blocked)"
              : step === 3
                ? "Confirm & Migrate"
                : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
