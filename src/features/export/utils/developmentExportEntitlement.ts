import type { ExportEntitlement } from "@/features/export/types/exportEntitlement";

/**
 * The entitlement used until accounts and subscriptions exist: everyone
 * may export. Not a "Pro" account and not a payment check — replace it
 * with a backend-verified implementation when billing is built.
 */
export const developmentExportEntitlement: ExportEntitlement = {
  canExportCode: () => Promise.resolve({ allowed: true }),
};
