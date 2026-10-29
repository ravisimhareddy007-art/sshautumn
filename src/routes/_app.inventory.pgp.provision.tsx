import { createFileRoute } from "@tanstack/react-router";
import { ProvisionPgpKeyPage } from "@/components/pgp/ProvisionPgpKeyPage";

type Search = { key?: string };

export const Route = createFileRoute("/_app/inventory/pgp/provision")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    key: typeof s.key === "string" ? s.key : undefined,
  }),
  component: function ProvisionRoute() {
    const { key } = Route.useSearch();
    return <ProvisionPgpKeyPage keyId={key} />;
  },
});
