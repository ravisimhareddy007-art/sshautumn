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
      <div className="inv-frame inv-frame--standalone">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="sl" style={{ left: 0, minWidth: 200, maxWidth: 200 }}>Device Name</th>
                <th>FQDN / IP</th>
                <th>Host Name</th>
                <th>Group</th>
                <th>Host Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.id}>
                  <td className="sl font-mono" style={{ left: 0, minWidth: 200, maxWidth: 200 }} title={h.deviceName}>{h.deviceName}</td>
                  <td className="font-mono" title={h.fqdn}>{h.fqdn}</td>
                  <td title={h.hostName}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-risk-green inline-block" />
                      {h.hostName}
                    </span>
                  </td>
                  <td>{h.group}</td>
                  <td>
                    <Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">
                      {h.hostStatus}
                    </Badge>
                  </td>
                  <td>
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toast.success(`Fetching keys from ${h.deviceName}…`)}>
                        Fetch Keys
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info(`User: ${h.username} · Port: ${h.port}`)}>
                        Credentials
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inv-pagination">
          <span>1 to {hosts.length} of {hosts.length}</span>
        </div>
      </div>
    </div>
  );
}
