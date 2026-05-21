import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ROTATED_CERTS, type RotatedCert } from "@/data/mock";
import { RollbackDialog } from "@/components/cert/RollbackDialog";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/certificates/rotated")({
  component: Page,
});

function Page() {
  const [list, setList] = useState<RotatedCert[]>(ROTATED_CERTS);
  const [rollback, setRollback] = useState<RotatedCert | null>(null);
  const [details, setDetails] = useState<RotatedCert | null>(null);

  const exportRow = (c: RotatedCert) => {
    toast.success("Exported to CSV.");
    void c;
  };

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
              <th className="text-left px-3 py-2 w-12">Actions</th>
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
                <td className="px-3 py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetails(c)}>View Details</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportRow(c)}>Export Row</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

      <Sheet open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
          {details && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <SheetTitle className="text-[16px]">{details.certKeyId}</SheetTitle>
                <div className="text-[12px] text-muted-foreground">Rotated certificate details</div>
              </SheetHeader>
              <div className="py-4 space-y-3 text-[13px]">
                <KV label="Cert Type" value={details.certType} />
                <KV label="Rotated On" value={details.rotatedOn} />
                <KV label="Rotated By" value={details.rotatedBy} />
                <KV label="Previous Valid To" value={details.previousValidTo} />
                <KV label="New Valid To" value={details.newValidTo} />
                <KV label="Endpoints" value={details.endpoints.join(", ") || "—"} mono />
                <KV
                  label="Rollback"
                  value={
                    details.rollbackAvailable
                      ? `Available until ${details.rollbackWindowExpiry}`
                      : "Expired"
                  }
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-[12px]" : ""}>{value}</div>
    </div>
  );
}
