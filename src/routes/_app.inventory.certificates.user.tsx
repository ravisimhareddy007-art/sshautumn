import { createFileRoute } from "@tanstack/react-router";
import { CertInventoryPage } from "@/components/cert/CertInventoryPage";
import { USER_CERTS } from "@/data/mock";

export const Route = createFileRoute("/_app/inventory/certificates/user")({
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
  component: () => (
    <CertInventoryPage
      scope="user"
      breadcrumbs={["INVENTORY", "CERTIFICATE INVENTORY", "User Certificate Inventory"]}
      title="User Certificate Inventory"
      initialCerts={USER_CERTS}
    />
  ),
});
