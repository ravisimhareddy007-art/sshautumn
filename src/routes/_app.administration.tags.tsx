import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common/Placeholder";

export const Route = createFileRoute("/_app/administration/tags")({
  component: () => <Placeholder breadcrumbs={["ADMINISTRATION", "Tags"]} title="Tags" />,
});
