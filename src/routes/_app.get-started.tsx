import { createFileRoute } from "@tanstack/react-router";
import { GetStartedPage } from "@/components/groups/GroupPages";

export const Route = createFileRoute("/_app/get-started")({
  component: GetStartedPage,
});
