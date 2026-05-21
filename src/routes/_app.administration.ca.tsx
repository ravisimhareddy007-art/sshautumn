import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CAS } from "@/data/mock";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/administration/ca")({
  component: () => (
    <div>
      <PageHeader breadcrumbs={["ADMINISTRATION", "Certificate Authority"]} title="Certificate Authority" />
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-[11px] uppercase-tracking text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">CA Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Expiry</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {CAS.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.type}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">
                    {c.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">{c.expiry}</td>
                <td className="px-3 py-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toast.info("View details — coming soon")}>View</Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.success("CA key rotation queued.")}>Rotate CA Key</Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.warning("CA deactivated.")}>Deactivate</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
});
