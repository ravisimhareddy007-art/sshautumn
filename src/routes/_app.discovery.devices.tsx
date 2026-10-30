import { createFileRoute } from "@tanstack/react-router";
import { ManagedDevicesPage } from "@/components/discovery/DiscoveryPages";

export const Route = createFileRoute("/_app/discovery/devices")({
  component: ManagedDevicesPage,
});
