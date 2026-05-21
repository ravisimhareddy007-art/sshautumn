import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ROTATED_CERTS, type RotatedCert } from "@/data/mock";
import { RollbackDialog } from "@/components/cert/RollbackDialog";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_app/inventory/certificates/rotated")({
  component: Page,
});

function Page() {
  const [list, setList] = useState<RotatedCert[]>(ROTATED_CERTS);
  const [rollback, setRollback] = useState<RotatedCert | null>(null);

  return (
    <div>
      <PageHeader
        breadcrumbs={["INVENTORY", "CERTIFICATE INVENTORY", "Recently Rotated Certificates"]}
        title="Recently Rotated Certificates"
        actions={
          <Button size="sm" variant="outline" onClick={() => toast.success("Exported to CSV.")}>
            Export All
          </Button>
        }
      />
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-[11px] uppercase-tracking text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Cert Key ID</th>
              <th className="text-left px-3 py-2">Cert Type</th>
              <th className="text-left px-3 py-2">Rotated On</th>
              <th className="text-left px-3 py-2">Previous Valid To</th>
              <th className="text-left px-3 py-2">New Valid To</th>
              <th className="text-left px-3 py-2">Rotated By</th>
              <th className="text-left px-3 py-2">Endpoint(s)</th>
              <th className="text-left px-3 py-2">Rollback</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{c.certKeyId}</td>
                <td className="px-3 py-2">{c.certType}</td>
                <td className="px-3 py-2">{c.rotatedOn}</td>
                <td className="px-3 py-2">{c.previousValidTo}</td>
                <td className="px-3 py-2">{c.newValidTo}</td>
                <td className="px-3 py-2">{c.rotatedBy}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{c.endpoints.join(", ")}</td>
                <td className="px-3 py-2">
                  {c.rollbackAvailable ? (
                    <Button size="sm" variant="outline" onClick={() => setRollback(c)}>
                      Rollback
                    </Button>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button size="sm" variant="outline" disabled>
                              Rollback
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Rollback window has expired (7 days). To revert, provision a new certificate.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RollbackDialog
        cert={rollback}
        onClose={() => setRollback(null)}
        onDone={(id) => setList((l) => l.filter((x) => x.id !== id))}
      />
    </div>
  );
}
