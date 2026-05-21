import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { SshKey, SshCert } from "@/data/mock";
import { USER_CERTS } from "@/data/mock";
import { AlertTriangle } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Phase = "confirm" | "diff" | "progress" | null;

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

  if (!ssKey) return null;
  const associatedCert: SshCert | undefined = ssKey.hasCert
    ? USER_CERTS.find((c) => c.associatedKeyId === ssKey.id)
    : undefined;

  const closeAll = () => {
    setPhase("confirm");
    onClose();
  };

  return (
    <>
      <Dialog
        open={phase === "confirm"}
        onOpenChange={(v) => !v && closeAll()}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Rotate SSH Keys</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] space-y-3">
            <div className="bg-risk-amber/10 border border-risk-amber/30 rounded-md p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
              <span>
                Rotating keys without discovering all the keys from all the hosts may result in
                access loss or authentication issues. Proceed with caution and ensure alternative
                authentication methods are in place.
              </span>
            </div>
            <p>
              The selected keys will be rotated according to the rotation configuration specified
              in the respective key policies.
            </p>
            <p className="font-medium">Are you absolutely certain you want to rotate the keys?</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAll}>No</Button>
            <Button onClick={() => setPhase(associatedCert ? "diff" : "progress")}>Yes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={phase === "diff"}
        onOpenChange={(v) => !v && closeAll()}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Certificate Parameters — Review Before Rotating</DialogTitle>
          </DialogHeader>

          {associatedCert && (
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded border border-border p-3 bg-surface">
                <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-2">
                  Current Cert Parameters
                </div>
                <KV k="Principals" v={associatedCert.principals.join(", ") || "—"} />
                <KV k="Extensions" v={associatedCert.extensions.join(", ") || "—"} />
                <KV k="Valid To" v={associatedCert.validTo} />
              </div>
              <div className="rounded border border-primary/40 p-3 bg-surface">
                <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-2">
                  New Cert Parameters (Current Policy)
                </div>
                <KV k="Principals" v={associatedCert.principals.join(", ") || "—"} />
                <KV k="Max Validity" v="60 days" diff />
                <KV k="Extensions" v="port-forwarding, pty" diff />
              </div>
            </div>
          )}

          <div className="rounded-md bg-risk-amber/10 border border-risk-amber/30 p-3 text-[12px] flex gap-2">
            <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
            <span>
              Policy changes detected. The new certificate will reflect the current policy
              configuration. Please review before confirming.
            </span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeAll}>Cancel</Button>
            <Button onClick={() => setPhase("progress")}>Confirm Rotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgressModal
        open={phase === "progress"}
        title="Rotating key"
        steps={
          associatedCert
            ? [
                "Generating new key pair…",
                "Issuing new certificate…",
                "Deploying cert to endpoints…",
                "Verifying cert deployment…",
                "Deploying new key…",
                "Removing old cert…",
              ]
            : [
                "Generating new key pair…",
                "Deploying new key to endpoints…",
                "Verifying deployment…",
                "Removing old key…",
              ]
        }
        onDone={() => {
          onDone(ssKey.id);
          toast.success("Rotation complete!");
        }}
        onClose={closeAll}
      />
    </>
  );
}

function KV({ k, v, diff }: { k: string; v: string; diff?: boolean }) {
  return (
    <div className="flex items-start gap-2 mb-1">
      <span className="w-[88px] text-muted-foreground">{k}</span>
      <span className={cn("flex-1 font-medium", diff && "bg-risk-amber/15 text-risk-amber px-1 rounded")}>
        {diff && "⚠ "}{v}
      </span>
    </div>
  );
}
