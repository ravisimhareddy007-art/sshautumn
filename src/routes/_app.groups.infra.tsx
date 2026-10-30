import { createFileRoute } from "@tanstack/react-router";
import { InfraGroupsPage } from "@/components/groups/GroupPages";

export const Route = createFileRoute("/_app/groups/infra")({
  component: InfraGroupsPage,
});
