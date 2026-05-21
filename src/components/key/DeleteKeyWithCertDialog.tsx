import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useState } from "react";
import type { SshKey, SshCert, CertStatus } from "@/data/mock";
import { USER_CERTS, HOST_CERTS } from "@/data/mock";
import { AlertTriangle } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";

type FlowType = "krl" | "expired" | "revoked";

export function DeleteKeyWithCertDialog({
  ssKey,
  onClose,
  onDone,
}: {
  ssKey: SshKey | null;
  onClose: () => void;
  onDone: (keyId: string, certIds: string[]) => void;
}) {
  const certsAll: SshCert[] = ssKey
    ? [...USER_CERTS, ...HOST_CERTS].filter((c) => c.associatedKeyId === ssKey.id)
    : [];
  const [selected, setSelected] = useState<string[]>([]);
  const [warnUncheck, setWarnUncheck] = useState<string | null>(null);
  const [progress, setProgress] = useState(false);

  useEffect(() => {
    setSelected(certsAll.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssKey?.id]);

  const flow = useMemo<FlowType>(() => {
    const selectedCerts = certsAll.filter((c) => selected.includes(c.id));
    if (selectedCerts.some((c) => c.status === "Active")) return "krl";
    if (selectedCerts.some((c) => c.status === "Expired")) return "expired";
    return "revoked";
  }, [certsAll, selected]);

  const steps = useMemo(() => {
    if (flow === "krl") {
      const caName = certsAll.find((c) => selected.includes(c.id))?.caName ?? "CA";
      return [
        `Updating KRL — adding cert serial to revocation list for ${caName}`,
        "Pushing updated KRL to all endpoints",
        "Verifying KRL receipt on each endpoint",
        "Removing certificate files from endpoints",
        "Deleting key from all endpoints",
        "Removing cert from AVX inventory",
        "Removing key from AVX inventory",
        "Writing deletion audit log",
      ];
    }
    if (flow === "expired") {
      return [
        "Removing expired certificate files from endpoints",
        "Deleting key from all endpoints",
        "Removing cert from AVX inventory",
        "Removing key from AVX inventory",
        "Writing deletion audit log",
      ];
    }
    return [
      "Removing revoked certificate files from endpoints",
      "Deleting key from all endpoints",
      "Removing cert from AVX inventory",
      "Removing key from AVX inventory",
      "Writing deletion audit log",
    ];
  }, [flow, certsAll, selected]);

  const infoText = useMemo(() => {
    if (flow === "krl") {
      return "Deleting the key will also revoke and remove the associated certificate from all endpoints. The KRL will be updated first to immediately invalidate the cert at the CA level.";
    }
    if (flow === "expired") {
      return "This key has an expired certificate. The certificate is already invalid, so the KRL update will be skipped. Files will be removed directly from endpoints.";
    }
    return "This key has a revoked certificate. The certificate is already present in the KRL, so the KRL update will be skipped. Files will be removed directly from endpoints.";
  }, [flow]);

  if (!ssKey) return null;

  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      setWarnUncheck(id);
    } else {
      setSelected([...selected, id]);
    }
  };

  const certStatusLabel = (s: CertStatus) => {
    switch (s) {
      case "Active":
        return "Active";
      case "Expired":
        return "Expired";
      case "Revoked":
        return "Revoked";
    }
  };

  const certStatusColor = (s: CertStatus) => {
    switch (s) {
      case "Active":
        return "text-risk-green";
      case "Expired":
        return "text-muted-foreground";
      case "Revoked":
        return "text-risk-red";
    }
  };

  return (
    <>
      <Dialog
        open={!!ssKey && !progress}
        onOpenChange={(v) => !v && onClose()}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Delete Key and Certificate</DialogTitle>
          </DialogHeader>

          <div className="text-[13px]">
            <div className="mb-2">
              Key: <span className="font-medium">{ssKey.name}</span>
            </div>
            <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-1">
              Associated Certificates
            </div>
            <div className="border border-border rounded-md divide-y">
              {certsAll.length === 0 && (
                <div className="px-3 py-2 text-muted-foreground">None</div>
              )}
              {certsAll.map((c) => (
                <div key={c.id}>
                  <label className="flex items-center gap-2 px-3 py-2">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => handleToggle(c.id)}
                    />
                    <span className="flex-1">
                      {c.certKeyId} — {c.certName}{" "}
                      <span className="text-muted-foreground text-[11px]">(auto-selected)</span>
                    </span>
                    <span className={`text-[11px] font-medium ${certStatusColor(c.status)}`}>
                      {certStatusLabel(c.status)}
                    </span>
                  </label>
                  {warnUncheck === c.id && (
                    <div className="px-3 pb-2 bg-risk-amber/10 border-t border-risk-amber/30 text-[12px] flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-1" />
                      <div className="flex-1 pt-1">
                        This certificate will remain active on endpoints for its remaining
                        validity period. Are you sure?
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelected(selected.filter((x) => x !== c.id));
                              setWarnUncheck(null);
                            }}
                          >
                            Confirm Deselect
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setWarnUncheck(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-risk-amber/10 border border-risk-amber/30 p-3 text-[12px] flex gap-2">
            <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
            <span>{infoText}</span>
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
        title="Deleting key and certificate"
        steps={steps}
        onDone={() => {
          onDone(ssKey.id, selected);
          toast.success("Key and certificate deleted successfully.");
        }}
        onClose={() => {
          setProgress(false);
          onClose();
        }}
      />
    </>
  );
}
