import { createFileRoute } from "@tanstack/react-router";
import { KeyInventoryPage } from "@/components/key/KeyInventoryPage";
import { HOST_KEYS } from "@/data/mock";

type Search = { highlight?: string };

export const Route = createFileRoute("/_app/inventory/keys/host")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    highlight: typeof s.highlight === "string" ? s.highlight : undefined,
  }),
  component: () => (
    <KeyInventoryPage
      scope="host"
      breadcrumbs={["INVENTORY", "KEY INVENTORY", "Host Key Inventory"]}
      title="Host Key Inventory"
      riskKinds={["Shared", "Weak"]}
      initialKeys={HOST_KEYS}
      total={HOST_KEYS.length}
    />
  ),
});
