import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import type { SshCert } from "@/data/mock";
import { AlertTriangle } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";

const REASONS = [
  "User offboarded",
  "Certificate compromised",
  "Device decommissioned",
  "Policy violation",
  "Other",
];

export function RevokeCertDialog({
  cert,
  onClose,
  onRevoked,
}: {
  cert: SshCert | null;
  onClose: () => void;
  onRevoked: (cert: SshCert) => void;
}) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [progress, setProgress] = useState(false);

  const reset = () => {
    setReasons([]);
    setProgress(false);
  };

  if (!cert) return null;

  return (
    <>
      <Dialog
        open={!!cert && !progress}
        onOpenChange={(v) => {
          if (!v) {
            reset();
            onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Revoke Certificate</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-[12px] grid grid-cols-2 gap-2">
            <Info label="Cert Key ID" value={cert.certKeyId} />
            <Info label="CA" value={cert.caName} />
            <Info label="Principals" value={cert.principals.join(", ") || "—"} />
            <Info label="Valid To" value={cert.validTo} />
          </div>

          <div className="rounded-md bg-risk-amber/10 border border-risk-amber/30 p-3 text-[12px] flex gap-2">
            <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
            <span>
              Revoking this certificate will update the KRL and push the update to all endpoints
              where this CA is trusted.
            </span>
          </div>

          <div>
            <div className="text-[12px] uppercase-tracking font-semibold text-muted-foreground mb-1">
              Endpoints receiving KRL update
            </div>
            <ul className="text-[13px] max-h-[120px] overflow-y-auto border border-border rounded-md p-2 bg-surface">
              {cert.endpoints.map((e) => (
                <li key={e} className="font-mono">• {e}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[12px] uppercase-tracking font-semibold text-muted-foreground mb-2">
              Reason for revocation (select at least one)
            </div>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={reasons.includes(r)}
                    onCheckedChange={(v) =>
                      setReasons((prev) =>
                        v ? [...prev, r] : prev.filter((x) => x !== r),
                      )
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button
              disabled={reasons.length === 0}
              onClick={() => setProgress(true)}
              className="bg-risk-red hover:bg-risk-red/90 text-white"
            >
              Confirm Revocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgressModal
        open={progress}
        title="Revoking certificate"
        steps={[
          "Marking cert as Revoked in AVX inventory…",
          `Adding cert serial to KRL for ${cert.caName}…`,
          "Pushing updated KRL to endpoints…",
          "Recording revocation audit event…",
          "Updating risk tile counts…",
        ]}
        onDone={() => {
          onRevoked(cert);
          toast.success(
            `Certificate revoked successfully. KRL pushed to ${cert.endpoints.length} endpoint${cert.endpoints.length === 1 ? "" : "s"}.`,
          );
        }}
        onClose={() => {
          reset();
          onClose();
        }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase-tracking">{label}</div>
      <div className="text-[13px] font-medium">{value}</div>
    </div>
  );
}
