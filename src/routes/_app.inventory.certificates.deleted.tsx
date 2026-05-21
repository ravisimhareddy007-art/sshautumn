import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DELETED_CERTS, type DeletedCert } from "@/data/mock";
import { RestoreDialog } from "@/components/cert/RestoreDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/certificates/deleted")({
  component: Page,
});

function Page() {
  const [list, setList] = useState<DeletedCert[]>(DELETED_CERTS);
  const [restore, setRestore] = useState<DeletedCert | null>(null);

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
    </div>
  );
}
