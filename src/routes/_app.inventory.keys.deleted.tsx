import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DELETED_KEYS } from "@/data/mock";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/keys/deleted")({
  component: () => (
    <div>
      <PageHeader
        breadcrumbs={["INVENTORY", "KEY INVENTORY", "Recently Deleted Keys"]}
        title="Recently Deleted Keys"
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
              <th className="text-left px-3 py-2">Key Name</th>
              <th className="text-left px-3 py-2">Encryption</th>
              <th className="text-left px-3 py-2">Length</th>
              <th className="text-left px-3 py-2">Deleted On</th>
              <th className="text-left px-3 py-2">Deleted By</th>
              <th className="text-left px-3 py-2">Endpoint(s)</th>
            </tr>
          </thead>
          <tbody>
            {DELETED_KEYS.map((k) => (
              <tr key={k.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{k.name}</td>
                <td className="px-3 py-2">{k.encryption}</td>
                <td className="px-3 py-2">{k.length}</td>
                <td className="px-3 py-2">{k.deletedOn}</td>
                <td className="px-3 py-2">{k.deletedBy}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{k.endpoints.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
});
