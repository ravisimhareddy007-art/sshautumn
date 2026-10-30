import { createFileRoute } from "@tanstack/react-router";
import { TagsPage } from "@/components/groups/GroupPages";

export const Route = createFileRoute("/_app/administration/tags")({
  component: TagsPage,
});
