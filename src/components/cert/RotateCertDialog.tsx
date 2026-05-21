import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { SshCert } from "@/data/mock";
import { AlertTriangle } from "lucide-react";
import { ProgressModal } from "@/components/common/ProgressModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RotateCertDialog({
  cert,
  onClose,
  onRotated,
}: {
  cert: SshCert | null;
  onClose: () => void;
  onRotated: (cert: SshCert) => void;
}) {
  const [progress, setProgress] = useState(false);
  if (!cert) return null;

  const newExtensions = ["port-forwarding", "pty"];
  const diffExtensions = cert.extensions.filter((e) => !newExtensions.includes(e));
  const hasDiff = diffExtensions.length > 0;

  return (
    <>
      <Dialog
        open={!!cert && !progress}
        onOpenChange={(v) => !v && onClose()}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Rotate Certificate — Independent Rotation</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <Panel title="Current Cert Parameters">
              <KV k="Principals" v={cert.principals.join(", ") || "—"} />
              <KV k="Valid To" v={cert.validTo} />
              <KV k="CA" v={cert.caName} />
              <KV k="Extensions" v={cert.extensions.join(", ") || "—"} />
            </Panel>
            <Panel title="New Cert Parameters (Current Policy)" highlight>
              <KV k="Principals" v={cert.principals.join(", ") || "—"} />
              <KV k="Max Validity" v="60 days" diff />
              <KV k="CA" v={cert.caName} />
              <KV k="Extensions" v={newExtensions.join(", ")} diff={hasDiff} />
            </Panel>
          </div>

          {hasDiff && (
            <div className="rounded-md bg-risk-amber/10 border border-risk-amber/30 p-3 text-[12px] flex gap-2">
              <AlertTriangle className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
              <span>
                Policy changes detected — current cert has{" "}
                <strong>{diffExtensions.join(", ")}</strong>; current policy does not.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setProgress(true)}>Confirm Rotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgressModal
        open={progress}
        title="Rotating certificate"
        steps={[
          "Issuing new cert against existing key…",
          "Deploying new cert to endpoints…",
          "Verifying cert deployment…",
          "Removing old cert from endpoints…",
          "Updating inventory…",
        ]}
        onDone={() => {
          onRotated(cert);
          toast.success("Certificate rotated successfully.");
        }}
        onClose={() => {
          setProgress(false);
          onClose();
        }}
      />
    </>
  );
}

function Panel({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 bg-surface",
        highlight ? "border-primary/40" : "border-border",
      )}
    >
      <div className="text-[11px] uppercase-tracking font-semibold text-muted-foreground mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function KV({ k, v, diff }: { k: string; v: string; diff?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-[88px] text-muted-foreground">{k}</span>
      <span
        className={cn(
          "flex-1 font-medium",
          diff && "bg-risk-amber/15 text-risk-amber px-1 rounded",
        )}
      >
        {diff && "⚠ "}
        {v}
      </span>
    </div>
  );
}
