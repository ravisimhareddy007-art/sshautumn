import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/policies/host")({
  component: () => <Placeholder breadcrumbs={["POLICIES", "Host Policy"]} title="Host Policy" />,
});
