import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { SshCert } from "@/data/mock";
import { DELETED_CERTS, type DeletedCert } from "@/data/mock";
import { AlertTriangle, Info as InfoIcon } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";

export function DeleteCertDialog({
  cert,
  onClose,
  onDeleted,
}: {
  cert: SshCert | null;
  onClose: () => void;
  onDeleted: (cert: SshCert) => void;
}) {
  const [progress, setProgress] = useState(false);

  if (!cert) return null;

  const isActive = cert.status === "Active";
  const isExpired = cert.status === "Expired";
  const isRevoked = cert.status === "Revoked";

  const steps = isActive
    ? [
        "Updating KRL — adding cert to revocation list",
        "Pushing KRL update to all endpoints",
        "Verifying KRL receipt on all endpoints",
        "Removing certificate files from endpoints",
        "Removing certificate from AVX inventory",
        "Writing deletion audit log",
      ]
    : isExpired
      ? [
          "Removing expired certificate files from endpoints",
          "Removing certificate from AVX inventory",
          "Writing deletion audit log",
        ]
      : [
          "Removing revoked certificate files from endpoints",
          "Removing certificate from AVX inventory",
          "Writing deletion audit log",
        ];

  const successToast = isActive
    ? `Certificate deleted. KRL updated on ${cert.endpoints.length} endpoint${cert.endpoints.length === 1 ? "" : "s"}.`
    : isExpired
      ? "Expired certificate deleted."
      : "Revoked certificate deleted.";

  return (
    <>
      <Dialog open={!!cert && !progress} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete Certificate</DialogTitle>
          </DialogHeader>

          {isActive && (
            <div className="rounded-md bg-risk-red/10 border border-risk-red/30 p-3 text-[12px] flex gap-2">
              <AlertTriangle className="h-4 w-4 text-risk-red shrink-0 mt-0.5" />
              <span>
                This certificate is currently active. Deleting it will first revoke it via KRL update
                before removing it from all endpoints. This cannot be undone.
              </span>
            </div>
          )}
          {isExpired && (
            <div className="rounded-md bg-risk-amber/10 border border-risk-amber/30 p-3 text-[12px] flex gap-2">
              <InfoIcon className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
              <span>
                This certificate has already expired and is no longer valid on any endpoint. No KRL
                update is needed.
              </span>
            </div>
          )}
          {isRevoked && (
            <div className="rounded-md bg-muted border border-border p-3 text-[12px] flex gap-2">
              <InfoIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                This certificate has already been revoked and is in the KRL. No further KRL update is
                needed.
              </span>
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/40 p-3 text-[12px] grid grid-cols-2 gap-2">
            <Info label="Cert Key ID" value={cert.certKeyId} />
            <Info label="CA" value={cert.caName} />
            <Info label="Valid To" value={cert.validTo} />
            {isActive && <Info label="Endpoints" value={String(cert.endpoints.length)} />}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-risk-red hover:bg-risk-red/90 text-white"
              onClick={() => setProgress(true)}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgressModal
        open={progress}
        title="Deleting certificate"
        steps={steps}
        onDone={() => {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          const deletedOn = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
          const reason = isActive
            ? "Active cert deletion (KRL updated)"
            : isExpired
              ? "Expired cert cleanup"
              : "Revoked cert cleanup";
          const newDeleted: DeletedCert = {
            id: `dc-${cert.id}-${Date.now()}`,
            certKeyId: cert.certKeyId,
            certType: cert.type === "user" ? "User" : "Host",
            deletedOn,
            deletedBy: "admin@appviewx.com",
            reason,
            lastKnownEndpoints: cert.endpoints,
            isRevoked: isActive || isRevoked,
            isExpired,
            validTo: cert.validTo,
            associatedKeyId: cert.associatedKeyId,
            associatedKeyName: cert.associatedKeyName,
          };
          DELETED_CERTS.unshift(newDeleted);
          onDeleted(cert);
          toast.success(successToast);
        }}
        onClose={() => {
          setProgress(false);
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
