import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/discovery/runs")({
  component: () => <Placeholder breadcrumbs={["DISCOVERY", "Discovery Runs"]} title="Discovery Runs" />,
});
