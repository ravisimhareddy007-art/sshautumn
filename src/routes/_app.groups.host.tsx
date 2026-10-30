import { createFileRoute } from "@tanstack/react-router";
import { HostGroupsPage } from "@/components/groups/GroupPages";

export const Route = createFileRoute("/_app/groups/host")({
  component: HostGroupsPage,
});
