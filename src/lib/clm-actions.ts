/**
 * CLM Action Availability -- REQ-43
 *
 * Single source of truth for which lifecycle actions are available
 * based on a key's discovered combination state.
 *
 * Three possible states per action:
 *   show: false            → Hidden — do not render in UI at all
 *   show: true, enabled: false, tooltip → Disabled with tooltip — render greyed out
 *   show: true, enabled: true           → Available — render and clickable
 */

import type { SshCert } from "@/data/mock";

export type KeyCombination =
  | "private_public"
  | "private_cert"
  | "public_cert"
  | "private_only"
  | "public_only";

export type CertCombination = KeyCombination | "cert_only";

export interface ActionAvailability {
  show: boolean;
  enabled: boolean;
  tooltip?: string;
}

// ── KEY-LEVEL ACTIONS (Key Inventory Actions menu) ─────────────────────────

/** Rotate Key — generates new key pair and re-deploys */
export function rotateKeyAction(combo: KeyCombination): ActionAvailability {
  switch (combo) {
    case "private_cert":
    case "private_public":
      return { show: true, enabled: true };
    case "private_only":
      return {
        show: true,
        enabled: false,
        tooltip:
          "Public key not discovered. AVX cannot determine deployment targets. Run discovery or specify endpoints before rotation.",
      };
    case "public_cert":
    case "public_only":
      return { show: false, enabled: false };
    default:
      return { show: false, enabled: false };
  }
}

/** Coupled Rotate — rotates key + cert together atomically (REQ-3) */
export function coupledRotateAction(combo: KeyCombination): ActionAvailability {
  if (combo === "private_cert") return { show: true, enabled: true };
  return { show: false, enabled: false };
}

/** Provision Certificate — issue a new cert against the key */
export function provisionCertAction(combo: KeyCombination): ActionAvailability {
  switch (combo) {
    case "private_public":
      return { show: true, enabled: true };
    case "private_only":
      return {
        show: true,
        enabled: false,
        tooltip:
          "Public key not separately discovered. AVX will derive the public key from the private key. Verify endpoint access paths before proceeding.",
      };
    case "public_only":
      return {
        show: true,
        enabled: false,
        tooltip:
          "Private key is not managed by AVX. A certificate can be issued against this public key, but the private key owner must apply it.",
      };
    case "private_cert":
    case "public_cert":
      return { show: false, enabled: false };
    default:
      return { show: false, enabled: false };
  }
}

// ── CERT-LEVEL ACTIONS (Cert Modal, Cert Inventory, Cert Detail Drawer) ────

/** Independent Cert Rotate — reissue cert without changing key pair (REQ-5) */
export function certRotateAction(
  certStatus: SshCert["status"],
  combo: CertCombination,
): ActionAvailability {
  if (certStatus === "Expired")
    return {
      show: true,
      enabled: false,
      tooltip:
        "Expired certificates cannot be rotated. Provision a new certificate from Key Inventory.",
    };
  if (certStatus === "Revoked")
    return {
      show: true,
      enabled: false,
      tooltip:
        "Revoked certificates cannot be rotated. Provision a new certificate from Key Inventory.",
    };

  switch (combo) {
    case "private_cert":
      return { show: true, enabled: true };
    case "public_cert":
    case "cert_only":
      return {
        show: true,
        enabled: false,
        tooltip:
          "Private key is not managed by AVX. New certificate will be issued against the existing public key. Verify the private key owner has access before proceeding.",
      };
    default:
      return { show: false, enabled: false };
  }
}

/** Revoke Certificate — adds cert to KRL and pushes to endpoints (REQ-23) */
export function certRevokeAction(certStatus: SshCert["status"]): ActionAvailability {
  if (certStatus === "Revoked")
    return {
      show: true,
      enabled: false,
      tooltip: "This certificate is already revoked.",
    };
  return { show: true, enabled: true };
}

/** Delete Certificate — removes cert record and cert file from endpoints (REQ-8) */
export function certDeleteAction(certStatus: SshCert["status"]): ActionAvailability {
  if (certStatus === "Revoked")
    return {
      show: true,
      enabled: false,
      tooltip:
        "Revoked certificates must remain in inventory for audit. They cannot be deleted.",
    };
  return { show: true, enabled: true };
}

// ── COMBINATION DISPLAY HELPERS ─────────────────────────────────────────────

export const COMBO_LABEL: Record<KeyCombination, string> = {
  private_public: "Private + Public",
  private_cert:   "Private + Cert",
  public_cert:    "Public + Cert",
  private_only:   "Private Only",
  public_only:    "Public Only",
};

export const COMBO_BADGE_CLASS: Record<KeyCombination, string> = {
  private_public: "bg-muted text-muted-foreground border-border",
  private_cert:   "bg-risk-green/10 text-risk-green border-risk-green/30",
  public_cert:    "bg-risk-amber/10 text-risk-amber border-risk-amber/30",
  private_only:   "bg-risk-amber/10 text-risk-amber border-risk-amber/30",
  public_only:    "bg-risk-red/10 text-risk-red border-risk-red/30",
};
