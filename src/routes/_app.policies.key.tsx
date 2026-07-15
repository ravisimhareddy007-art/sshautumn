import { createFileRoute } from "@tanstack/react-router";
import { KeyPolicyPage } from "@/components/policy/KeyPolicyPage";

export const Route = createFileRoute("/_app/policies/key")({
  component: KeyPolicyPage,
});
