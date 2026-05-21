import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/discovery/status")({
  component: () => (
    <div>
      <PageHeader breadcrumbs={["DISCOVERY", "Discovery Status"]} title="Discovery Status" />
      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="certs">Certificates</TabsTrigger>
        </TabsList>
        <TabsContent value="keys">
          <Card className="p-6 text-[13px]">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="User Keys Discovered" value="75" />
              <Stat label="Host Keys Discovered" value="23" />
              <Stat label="Last Scan" value="2026-05-20 14:30:00" />
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="certs">
          <Card className="p-6 text-[13px]">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Stat label="CAs Discovered" value="2" />
              <Stat label="User Certs Discovered" value="6" />
              <Stat label="Host Certs Discovered" value="2" />
              <Stat label="Scan Status" value={<Badge className="bg-risk-green/15 text-risk-green border-risk-green/30" variant="outline">Completed</Badge>} />
            </div>
            <div className="text-[11px] uppercase-tracking text-muted-foreground mb-2">Per-Endpoint Breakdown</div>
            <table className="w-full text-[13px] border border-border rounded-md overflow-hidden">
              <thead className="bg-muted/50 text-[11px] uppercase-tracking text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Endpoint</th>
                  <th className="text-left px-3 py-2">User Certs</th>
                  <th className="text-left px-3 py-2">Host Certs</th>
                  <th className="text-left px-3 py-2">Last Scan</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono">192.168.223.50</td>
                  <td className="px-3 py-2">2</td>
                  <td className="px-3 py-2">1</td>
                  <td className="px-3 py-2">2026-05-20 14:32:00</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">Completed</Badge></td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono">192.168.223.51</td>
                  <td className="px-3 py-2">4</td>
                  <td className="px-3 py-2">1</td>
                  <td className="px-3 py-2">2026-05-20 14:30:00</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">Completed</Badge></td>
                </tr>
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  ),
});

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase-tracking text-muted-foreground">{label}</div>
      <div className="text-[18px] font-semibold mt-1">{value}</div>
    </div>
  );
}
