import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import type { SshKey, SshCert } from "@/data/mock";
import { USER_CERTS, HOST_CERTS } from "@/data/mock";
import { AlertTriangle, Key, FileCheck2 } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Phase = "confirm" | "expiredChoice" | "review" | "progress" | null;
type ExpiredOption = "keyOnly" | "keyAndCert";

// Current key policy used to detect parameter diffs against existing cert
const POLICY = {
  maxValidityDays: 60,
  extensions: ["port-forwarding", "pty"],
};

export function RotateKeyDialog({
  ssKey,
  onClose,
  onDone,
}: {
  ssKey: SshKey | null;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [expiredOption, setExpiredOption] = useState<ExpiredOption>("keyOnly");
  const [reviewAck, setReviewAck] = useState(false);

  const associatedCert: SshCert | undefined = useMemo(() => {
    if (!ssKey?.hasCert) return undefined;
    return [...USER_CERTS, ...HOST_CERTS].find((c) => c.associatedKeyId === ssKey.id);
  }, [ssKey]);

  // Determine starting phase based on cert state
  const initialPhase: Phase = useMemo(() => {
    if (!ssKey) return null;
    if (!associatedCert) return "confirm"; // CASE 1
    if (associatedCert.status === "Active") return "review"; // CASE 2
    return "expiredChoice"; // CASE 3 / 4 (Expired / Revoked)
  }, [ssKey, associatedCert]);

  // Resync phase whenever a new key is opened
  useMemo(() => {
    if (ssKey) {
      setPhase(initialPhase);
      setReviewAck(false);
      setExpiredOption("keyOnly");
    }
  }, [ssKey, initialPhase]);

  if (!ssKey) return null;

  const closeAll = () => {
    setPhase(null);
    setReviewAck(false);
    setExpiredOption("keyOnly");
    onClose();
  };

  // ---- Determine progress steps for the active flow ----
  const isCoupledFlow =
    (associatedCert?.status === "Active") ||
    (associatedCert && associatedCert.status !== "Active" && expiredOption === "keyAndCert");

  const keyOnlyExpiredCleanup =
    associatedCert && associatedCert.status !== "Active" && expiredOption === "keyOnly";

  const progressSteps: string[] = isCoupledFlow
    ? [
        "Generating new key pair",
        "Issuing new certificate against new key (current policy)",
        "Deploying new certificate to all endpoints",
        "Verifying certificate deployment per endpoint",
        "Updating KRL — invalidating old certificate at CA level",
        "Pushing KRL update to all endpoints",
        "Deploying new key to all endpoints",
        "Verifying key deployment",
        "Removing old certificate files from endpoints",
        "Writing coupled rotation audit log",
      ]
    : keyOnlyExpiredCleanup
      ? [
          "Generating new key pair on AVX server",
          "Deploying new key to all endpoints",
          "Verifying key deployment on each endpoint",
          "Removing expired certificate from endpoints",
          "Removing old key from endpoints",
          "Writing rotation audit log",
        ]
      : [
          "Generating new key pair on AVX server",
          "Deploying new key to all endpoints",
          "Verifying key deployment on each endpoint",
          "Removing old key from endpoints",
          "Writing rotation audit log",
        ];

  const successToast = isCoupledFlow
    ? "Key + Certificate rotated successfully. Policy changes applied."
    : "Key rotated successfully.";

  // ---- Diff detection for review screen ----
  const policyExtSet = new Set(POLICY.extensions);
  const currentExtSet = new Set(associatedCert?.extensions ?? []);
  const extensionsDiffer =
    associatedCert &&
    (policyExtSet.size !== currentExtSet.size ||
      [...policyExtSet].some((e) => !currentExtSet.has(e)));
  const validityDiffers = true; // policy always 60 days; existing cert validity varies

  return (
    <>
      {/* CASE 1: simple confirm — key has no cert */}
      <Dialog open={phase === "confirm"} onOpenChange={(v) => !v && closeAll()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Rotate SSH Keys</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] space-y-3">
            <div className="bg-risk-amber/10 border border-risk-amber/30 rounded-md p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
              <span>
                Rotating keys without discovering all keys from all hosts may result in access loss.
                Proceed with caution.
              </span>
            </div>
            <p className="font-medium">Are you absolutely certain you want to rotate the keys?</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAll}>No</Button>
            <Button onClick={() => setPhase("progress")}>Yes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CASE 3 / 4: expired or revoked cert — choose flow */}
      <Dialog open={phase === "expiredChoice"} onOpenChange={(v) => !v && closeAll()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Rotate Key — Certificate {associatedCert?.status}</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] space-y-3">
            <div className="bg-risk-amber/10 border border-risk-amber/30 rounded-md p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
              <span>
                {associatedCert?.status === "Revoked"
                  ? "This key has a revoked certificate. Since the certificate has already been invalidated, you may rotate the key independently, or rotate the key and provision a fresh certificate."
                  : "This key has an expired certificate. Since the certificate is no longer valid, you may rotate the key independently, or rotate the key and provision a fresh certificate."}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <OptionCard
                icon={<Key className="h-4 w-4" />}
                title="Rotate Key Only"
                description="The key will be rotated. The expired certificate will be removed from endpoints as part of this operation."
                selected={expiredOption === "keyOnly"}
                onSelect={() => setExpiredOption("keyOnly")}
              />
              <OptionCard
                icon={<FileCheck2 className="h-4 w-4" />}
                title="Rotate Key + Provision New Certificate"
                description="A new key pair will be generated and a new certificate will be issued and deployed immediately."
                selected={expiredOption === "keyAndCert"}
                onSelect={() => setExpiredOption("keyAndCert")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAll}>Cancel</Button>
            <Button
              onClick={() => setPhase(expiredOption === "keyAndCert" ? "review" : "progress")}
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CASE 2 (and CASE 3/4 option B): Pre-rotation review */}
      <Dialog open={phase === "review"} onOpenChange={(v) => !v && closeAll()}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Coupled Key + Certificate Rotation — Review Before Proceeding</DialogTitle>
          </DialogHeader>

          {associatedCert && (
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded border border-border p-3 bg-surface">
                <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-2">
                  Current Certificate Parameters
                </div>
                <KV k="CA / Issuer" v={associatedCert.caName} />
                <KV k="Principals" v={associatedCert.principals.join(", ") || "—"} />
                <KV k="Valid To" v={associatedCert.validTo} />
                <KV k="Extensions" v={associatedCert.extensions.join(", ") || "—"} />
              </div>
              <div className="rounded border border-primary/40 p-3 bg-surface">
                <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-2">
                  New Certificate Parameters (Current Policy)
                </div>
                <KV k="CA / Issuer" v={associatedCert.caName} />
                <KV k="Principals" v={associatedCert.principals.join(", ") || "—"} />
                <KV k="Max Validity" v={`${POLICY.maxValidityDays} days`} diff={validityDiffers} />
                <KV k="Extensions" v={POLICY.extensions.join(", ")} diff={!!extensionsDiffer} />
              </div>
            </div>
          )}

          <div className="rounded-md bg-risk-amber/10 border border-risk-amber/30 p-3 text-[12px] flex gap-2">
            <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
            <span>
              Policy changes detected. The new certificate will reflect the current policy. Review
              all changes carefully before confirming.
            </span>
          </div>

          <label className="flex items-start gap-2 text-[13px] cursor-pointer select-none">
            <Checkbox
              checked={reviewAck}
              onCheckedChange={(v) => setReviewAck(!!v)}
              className="mt-0.5"
            />
            <span>I have reviewed all parameter changes and confirm the rotation</span>
          </label>

          <DialogFooter>
            <Button variant="ghost" onClick={closeAll}>Cancel</Button>
            <Button disabled={!reviewAck} onClick={() => setPhase("progress")}>
              Confirm Rotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgressModal
        open={phase === "progress"}
        title={isCoupledFlow ? "Rotating key + certificate" : "Rotating key"}
        steps={progressSteps}
        onDone={() => {
          onDone(ssKey.id);
          toast.success(successToast);
        }}
        onClose={closeAll}
      />
    </>
  );
}

function KV({ k, v, diff }: { k: string; v: string; diff?: boolean }) {
  return (
    <div className="flex items-start gap-2 mb-1">
      <span className="w-[100px] text-muted-foreground shrink-0">{k}</span>
      <span
        className={cn(
          "flex-1 font-medium",
          diff && "px-1 rounded",
        )}
        style={diff ? { background: "#FEF3C7", color: "#92400E" } : undefined}
      >
        {diff && "⚠ "}
        {v}
      </span>
    </div>
  );
}

function OptionCard({
  icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-md border p-3 transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-surface hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2 font-medium text-[13px]">
        <span className={cn(selected ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        {title}
      </div>
      <div className="text-[12px] text-muted-foreground mt-1">{description}</div>
    </button>
  );
}
