import { createFileRoute } from "@tanstack/react-router";
import { SchedulerPage } from "@/components/discovery/DiscoveryPages";

export const Route = createFileRoute("/_app/discovery/scheduler")({
  component: SchedulerPage,
});
