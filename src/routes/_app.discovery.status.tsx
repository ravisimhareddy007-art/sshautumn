import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryStatusPage } from "@/components/discovery/DiscoveryPages";

export const Route = createFileRoute("/_app/discovery/status")({
  component: DiscoveryStatusPage,
});
