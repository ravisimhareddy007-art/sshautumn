import { createFileRoute } from "@tanstack/react-router";
import { KeyGroupsPage } from "@/components/groups/GroupPages";

export const Route = createFileRoute("/_app/groups/key")({
  component: KeyGroupsPage,
});
