import { createFileRoute } from "@tanstack/react-router";
import { KeyInventoryPage } from "@/components/key/KeyInventoryPage";
import { USER_KEYS } from "@/data/mock";

type Search = { highlight?: string };

export const Route = createFileRoute("/_app/inventory/keys/user")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    highlight: typeof s.highlight === "string" ? s.highlight : undefined,
  }),
  component: () => (
    <KeyInventoryPage
      scope="user"
      breadcrumbs={["INVENTORY", "KEY INVENTORY", "User Key Inventory"]}
      title="User Key Inventory"
      riskKinds={["Shared", "Weak", "Rogue", "Misplaced", "Suspicious"]}
      initialKeys={USER_KEYS}
      total={USER_KEYS.length}
    />
  ),
});
