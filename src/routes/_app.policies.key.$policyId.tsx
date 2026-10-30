import { createFileRoute } from "@tanstack/react-router";
import { KeyPolicyFormPage } from "@/components/policy/KeyPolicyFormPage";

export const Route = createFileRoute("/_app/policies/key/$policyId")({
  component: function EditPolicyRoute() {
    const { policyId } = Route.useParams();
    return <KeyPolicyFormPage key={policyId} policyId={policyId} />;
  },
});
