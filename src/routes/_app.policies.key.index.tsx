import { createFileRoute } from "@tanstack/react-router";
import { KeyPolicyListPage } from "@/components/policy/KeyPolicyListPage";

export const Route = createFileRoute("/_app/policies/key/")({
  component: KeyPolicyListPage,
});
