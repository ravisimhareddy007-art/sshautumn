import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DELETED_CERTS, type DeletedCert } from "@/data/mock";
import { RestoreDialog } from "@/components/cert/RestoreDialog";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/certificates/deleted")({
  component: Page,
});

function Page() {
  const [list, setList] = useState<DeletedCert[]>(DELETED_CERTS);
  const [restore, setRestore] = useState<DeletedCert | null>(null);
  const [details, setDetails] = useState<DeletedCert | null>(null);

  return (
    <div>
      <PageHeader
        breadcrumbs={["INVENTORY", "CERTIFICATE INVENTORY", "Recently Deleted Certificates"]}
        title="Recently Deleted Certificates"
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
              <th className="text-left px-3 py-2">Deleted On</th>
              <th className="text-left px-3 py-2">Deleted By</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-left px-3 py-2">Last Known Endpoint(s)</th>
              <th className="text-left px-3 py-2">Restore</th>
              <th className="text-left px-3 py-2 w-12">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{c.certKeyId}</td>
                <td className="px-3 py-2">{c.certType}</td>
                <td className="px-3 py-2">{c.deletedOn}</td>
                <td className="px-3 py-2">{c.deletedBy}</td>
                <td className="px-3 py-2">{c.reason}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{c.lastKnownEndpoints.join(", ")}</td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => setRestore(c)}>
                    Restore
                  </Button>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RestoreDialog
        cert={restore}
        onClose={() => setRestore(null)}
        onDone={(id) => setList((l) => l.filter((x) => x.id !== id))}
      />

      <Sheet open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
          {details && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <SheetTitle className="text-[16px]">{details.certKeyId}</SheetTitle>
                <div className="text-[12px] text-muted-foreground">Deleted certificate details</div>
              </SheetHeader>
              <div className="py-4 space-y-3 text-[13px]">
                <KV label="Cert Type" value={details.certType} />
                <KV label="Deleted On" value={details.deletedOn} />
                <KV label="Deleted By" value={details.deletedBy} />
                <KV label="Reason" value={details.reason} />
                <KV label="Valid To" value={details.validTo} />
                <KV label="Associated Key" value={details.associatedKeyName} />
                <KV
                  label="Last Known Endpoints"
                  value={details.lastKnownEndpoints.join(", ") || "—"}
                  mono
                />
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Revocation Status
                  </div>
                  <div>
                    {details.isRevoked ? (
                      <Badge variant="outline" className="bg-risk-red/15 text-risk-red border-risk-red/30">
                        Revoked (in KRL)
                      </Badge>
                    ) : details.isExpired ? (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                        Expired (no KRL entry)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-risk-amber/15 text-risk-amber border-risk-amber/30">
                        Not revoked
                      </Badge>
                    )}
                  </div>
                </div>
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
