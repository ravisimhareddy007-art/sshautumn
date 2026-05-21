import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { USER_KEYS, HOST_KEYS, type DeletedCert } from "@/data/mock";
import { Check, X } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";

export function RestoreDialog({
  cert,
  onClose,
  onDone,
}: {
  cert: DeletedCert | null;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [progress, setProgress] = useState(false);
  if (!cert) return null;

  // Hard block guards (evaluated in order)
  const revoked = cert.isRevoked;
  const expired = !revoked && (cert.isExpired || new Date(cert.validTo).getTime() < Date.now());
  const parentKeyExists = [...USER_KEYS, ...HOST_KEYS].some((k) => k.id === cert.associatedKeyId);
  const keyMissing = !revoked && !expired && !parentKeyExists;

  const hardBlocked = revoked || expired || keyMissing;

  return (
    <>
      <Dialog
        open={!!cert && !progress}
        onOpenChange={(v) => !v && onClose()}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Restore Certificate</DialogTitle>
          </DialogHeader>

          {revoked ? (
            <HardBlock
              title="Revocation Guard — HARD BLOCK"
              message="This certificate was revoked and cannot be restored. Revocation is a deliberate security action. To re-establish access, provision a new certificate."
              onClose={onClose}
            />
          ) : expired ? (
            <HardBlock
              title="Validity Guard — HARD BLOCK"
              message={`This certificate expired on ${cert.validTo}. Restoring an expired certificate is not possible — endpoints will immediately reject it. To re-establish access, provision a new certificate from Key Inventory.`}
              onClose={onClose}
            />
          ) : keyMissing ? (
            <HardBlock
              title="Associated Key — HARD BLOCK"
              message={`The SSH key this certificate was issued for (${cert.associatedKeyName}) no longer exists in inventory. A certificate cannot be deployed without its parent key. To re-establish access, add the host, discover or generate a new key, then provision a new certificate.`}
              onClose={onClose}
            />
          ) : (
            <>
              <ul className="space-y-2 text-[13px]">
                <Guard ok label="Revocation Guard — Certificate is not in the KRL" />
                <Guard ok label={`Validity Guard — Certificate valid until ${cert.validTo}`} />
                <Guard ok label={`Associated Key Exists — ${cert.associatedKeyName} found in inventory`} />
                <Guard ok label="Endpoint Availability — All original endpoints available" />
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5 inline-block h-4 w-4 text-center">─</span>
                  Duplicate Active Cert — No active cert found for this key (N/A)
                </li>
              </ul>
              <DialogFooter>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={() => setProgress(true)}>Confirm Restore</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {!hardBlocked && (
        <ProgressModal
          open={progress}
          title="Restoring certificate"
          steps={[
            "Running pre-restore checks…",
            `Re-deploying cert to ${cert.lastKnownEndpoints[0] ?? "endpoints"}…`,
            "Verifying cert deployment…",
            "Restoring cert to Active status in inventory…",
            "Writing restore audit log…",
          ]}
          onDone={() => {
            onDone(cert.id);
            toast.success(
              "Certificate restored successfully. Now active in User Certificate Inventory.",
            );
          }}
          onClose={() => {
            setProgress(false);
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

function Guard({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok && <Check className="h-4 w-4 text-risk-green mt-0.5 shrink-0" />}
      <span>{label}</span>
    </li>
  );
}
