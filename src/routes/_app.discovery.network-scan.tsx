import { createFileRoute } from "@tanstack/react-router";
import { NetworkScanPage } from "@/components/discovery/NetworkScanPage";

export const Route = createFileRoute("/_app/discovery/network-scan")({
  component: NetworkScanPage,
});
