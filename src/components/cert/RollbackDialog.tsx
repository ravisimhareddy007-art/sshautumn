import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import type { RotatedCert } from "@/data/mock";
import { USER_KEYS, HOST_KEYS } from "@/data/mock";
import { Check, X, AlertTriangle } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";

export function RollbackDialog({
  cert,
  onClose,
  onDone,
}: {
  cert: RotatedCert | null;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(false);

  if (!cert) return null;

  // Hard block guards (evaluated in order)
  const prevExpired = new Date(cert.previousValidTo).getTime() < Date.now();
  const keyExists = [...USER_KEYS, ...HOST_KEYS].some((k) => k.id === cert.associatedKeyId);

  const hardBlocked = prevExpired || !keyExists;

  return (
    <>
      <Dialog
        open={!!cert && !progress}
        onOpenChange={(v) => {
          if (!v) {
            setConfirm(false);
            onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Roll Back Certificate</DialogTitle>
          </DialogHeader>

          {prevExpired ? (
            <HardBlock
              title="Validity Guard — HARD BLOCK"
              message={`The previous certificate expired on ${cert.previousValidTo} and can no longer be restored to endpoints — they would immediately reject it. To revert access, provision a new certificate from Key Inventory.`}
              onClose={onClose}
            />
          ) : !keyExists ? (
            <HardBlock
              title="Associated Key — HARD BLOCK"
              message="The key this certificate was originally issued for no longer exists in inventory. Rollback is not possible."
              onClose={onClose}
            />
          ) : (
            <>
              <ul className="space-y-2 text-[13px]">
                <Guard ok label="Revocation Guard — Certificate is not in the KRL" />
                <Guard ok label={`Validity Guard — Previous certificate valid until ${cert.previousValidTo}`} />
                <Guard ok label="Endpoint Availability — All original endpoints are available" />
                <Guard
                  warn
                  label="Duplicate Active Cert — An active certificate exists for this key on the target endpoints. Rolling back will replace the current active cert."
                />
                <Guard ok label="Associated Key Exists — Parent key found in inventory" />
              </ul>

              <label className="flex items-center gap-2 text-[13px] mt-2 p-2 bg-risk-amber/10 rounded border border-risk-amber/30">
                <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} />
                Confirm to proceed despite duplicate active certificate
              </label>

              <DialogFooter>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button disabled={!confirm} onClick={() => setProgress(true)}>
                  Confirm Rollback
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {!hardBlocked && (
        <ProgressModal
          open={progress}
          title="Rolling back certificate"
          steps={[
            "Removing current (post-rotation) cert from endpoints…",
            "Verifying removal…",
            "Re-deploying previous cert to endpoints…",
            "Verifying previous cert deployment…",
            "Updating inventory…",
          ]}
          onDone={() => {
            onDone(cert.id);
            toast.success("Rollback successful. Previous certificate is now active.");
          }}
          onClose={() => {
            setProgress(false);
            setConfirm(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

function HardBlock({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <>
      <ul className="space-y-2 text-[13px]">
        <li className="flex items-start gap-2">
          <X className="h-4 w-4 text-risk-red mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-risk-red">{title}</div>
            <div className="text-muted-foreground">{message}</div>
          </div>
        </li>
      </ul>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </DialogFooter>
    </>
  );
}

function Guard({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok && <Check className="h-4 w-4 text-risk-green mt-0.5 shrink-0" />}
      {warn && <AlertTriangle className="h-4 w-4 text-risk-amber mt-0.5 shrink-0" />}
      <span className={warn ? "text-foreground" : "text-foreground"}>{label}</span>
    </li>
  );
}
