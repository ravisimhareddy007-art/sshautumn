import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/administration/settings")({
  component: () => <Placeholder breadcrumbs={["ADMINISTRATION", "Advanced Settings"]} title="Advanced Settings" />,
});
