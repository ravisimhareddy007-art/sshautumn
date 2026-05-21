import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/discovery/profiles")({
  component: () => <Placeholder breadcrumbs={["DISCOVERY", "Discovery Profiles"]} title="Discovery Profiles" />,
});
