import type { ExportAsset } from "@/features/export/types/exportIr";

export interface ExportAssetSummary {
  /** Distinct http(s) URLs: loaded from the internet whenever the page is viewed. */
  remote: string[];
  /** Distinct relative paths: files that must be published next to the page. */
  relative: string[];
}

/**
 * What the exported page still needs from outside its own files
 * (EXPORT-1.4). Export never downloads or bundles these; the dialog says
 * so instead of implying the page works fully offline. data: URLs are
 * embedded in the page and need nothing.
 */
export function summarizeExportAssets(assets: readonly ExportAsset[]): ExportAssetSummary {
  const remote = new Set<string>();
  const relative = new Set<string>();
  for (const asset of assets) {
    if (asset.kind === "remote") remote.add(asset.url);
    else if (asset.kind === "relative") relative.add(asset.url);
  }
  return { remote: [...remote], relative: [...relative] };
}
