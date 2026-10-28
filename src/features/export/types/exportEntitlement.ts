/**
 * Whether the current user may export code (EXPORT-1.4). Code export is
 * planned as a paid capability; this is the one place the export UI asks.
 * The generator itself never sees it: exportHtmlCss stays pure and knows
 * nothing about accounts or billing.
 *
 * A check in the page is a product decision, not enforcement — anyone can
 * change client code. When subscriptions exist, the implementation must
 * ask a trusted backend (see docs/architecture/export-engine.md).
 */
export interface ExportEntitlement {
  canExportCode(): Promise<ExportEntitlementDecision>;
}

export type ExportEntitlementDecision =
  | { allowed: true }
  /** `message` is shown to the user as the reason. */
  | { allowed: false; message: string };
