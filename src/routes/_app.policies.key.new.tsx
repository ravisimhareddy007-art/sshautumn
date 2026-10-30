import { createFileRoute } from "@tanstack/react-router";
import { KeyPolicyFormPage } from "@/components/policy/KeyPolicyFormPage";

export const Route = createFileRoute("/_app/policies/key/new")({
  component: () => <KeyPolicyFormPage />,
});
