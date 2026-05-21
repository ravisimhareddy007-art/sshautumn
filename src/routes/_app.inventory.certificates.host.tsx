import { createFileRoute } from "@tanstack/react-router";
import { CertInventoryPage } from "@/components/cert/CertInventoryPage";
import { HOST_CERTS } from "@/data/mock";

export const Route = createFileRoute("/_app/inventory/certificates/host")({
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
  component: () => (
    <CertInventoryPage
      scope="host"
      breadcrumbs={["INVENTORY", "CERTIFICATE INVENTORY", "Host Certificate Inventory"]}
      title="Host Certificate Inventory"
      initialCerts={HOST_CERTS}
    />
  ),
});
