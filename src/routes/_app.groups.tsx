import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/groups")({
  component: () => <Placeholder breadcrumbs={["GROUPS"]} title="Groups" />,
});
