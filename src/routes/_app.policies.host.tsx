import { createFileRoute } from "@tanstack/react-router";
import { HostPolicyPage } from "@/components/groups/GroupPages";

export const Route = createFileRoute("/_app/policies/host")({
  component: HostPolicyPage,
});
