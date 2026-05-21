import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DELETED_KEYS } from "@/data/mock";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

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
      <div className="inv-frame inv-frame--standalone">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="sl" style={{ left: 0, minWidth: 240, maxWidth: 240 }}>Key Name</th>
                <th>Encryption</th>
                <th>Length</th>
                <th>Deleted On</th>
                <th>Deleted By</th>
                <th>Endpoint(s)</th>
                <th style={{ width: 56 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {DELETED_KEYS.map((k) => (
                <tr key={k.id}>
                  <td className="sl" style={{ left: 0, minWidth: 240, maxWidth: 240 }} title={k.name}>
                    <span className="truncate-inner font-medium">{k.name}</span>
                  </td>
                  <td>{k.encryption}</td>
                  <td>{k.length}</td>
                  <td>{k.deletedOn}</td>
                  <td>{k.deletedBy}</td>
                  <td className="font-mono text-[12px]" title={k.endpoints.join(", ")}>
                    <span className="truncate-inner">{k.endpoints.join(", ") || "—"}</span>
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.success("Exported to CSV.")}>
                          Export Row
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {DELETED_KEYS.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ height: "auto", whiteSpace: "normal", textAlign: "center", padding: "48px", color: "var(--color-muted-foreground)", maxWidth: "none" }}>
                    No recently deleted keys.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="inv-pagination">
          <span>
            {DELETED_KEYS.length === 0 ? 0 : 1} to {DELETED_KEYS.length} of {DELETED_KEYS.length}
          </span>
        </div>
      </div>
    </div>
  ),
});
