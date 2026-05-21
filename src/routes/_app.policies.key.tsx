import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/policies/key")({
  component: () => <Placeholder breadcrumbs={["POLICIES", "Key Policy"]} title="Key Policy" />,
});
