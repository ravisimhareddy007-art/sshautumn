import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/administration/devices")({
  component: () => <Placeholder breadcrumbs={["ADMINISTRATION", "Device Management"]} title="Device Management" />,
});
