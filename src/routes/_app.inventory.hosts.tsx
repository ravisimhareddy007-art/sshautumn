import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HOSTS, type Host } from "@/data/mock";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/hosts")({
  component: Page,
});

function Page() {
  const [hosts] = useState<Host[]>(HOSTS);
  return (
    <div>
      <PageHeader
        breadcrumbs={["INVENTORY", "Host Inventory"]}
        title="Host Inventory"
        actions={
          <>
            <Button size="sm" onClick={() => toast.info("Add Host — Coming Soon")}>+ Add Host</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success("Exported to CSV.")}>Export</Button>
          </>
        }
      />
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-[11px] uppercase-tracking text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Device Name</th>
              <th className="text-left px-3 py-2">FQDN / IP</th>
              <th className="text-left px-3 py-2">Host Name</th>
              <th className="text-left px-3 py-2">Group</th>
              <th className="text-left px-3 py-2">Host Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{h.deviceName}</td>
                <td className="px-3 py-2 font-mono">{h.fqdn}</td>
                <td className="px-3 py-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-green inline-block" />
                  {h.hostName}
                </td>
                <td className="px-3 py-2">{h.group}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">
                    {h.hostStatus}
                  </Badge>
                </td>
                <td className="px-3 py-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toast.success(`Fetching keys from ${h.deviceName}…`)}>
                    Fetch Keys
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.info(`User: ${h.username} · Port: ${h.port}`)}>
                    Credentials
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
