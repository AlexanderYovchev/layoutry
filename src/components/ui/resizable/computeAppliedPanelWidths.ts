export interface ComputeAppliedPanelWidthsOptions {
  viewportWidth: number;
  resourceWidth: number;
  resourceMinWidth: number;
  inspectorWidth: number;
  inspectorMinWidth: number;
  minWorkspaceWidth: number;
}

export interface AppliedPanelWidths {
  resourceWidth: number;
  inspectorWidth: number;
}

/**
 * Keeps the Resource Panel, Inspector, and a minimum Workspace width from
 * ever summing past the viewport — without touching either panel's
 * stored preference, which lives entirely outside this function.
 *
 * Per the shell's responsive priority (Canvas first, then Inspector,
 * then the Resource Panel), the Resource Panel is softened first when
 * space runs out; the Inspector is only reduced if shrinking the
 * Resource Panel down to its minimum still isn't enough.
 *
 * Callers are expected to pass 0 for both a hidden panel's width and its
 * minWidth so it contributes nothing to the calculation.
 */
export function computeAppliedPanelWidths({
  viewportWidth,
  resourceWidth,
  resourceMinWidth,
  inspectorWidth,
  inspectorMinWidth,
  minWorkspaceWidth,
}: ComputeAppliedPanelWidthsOptions): AppliedPanelWidths {
  const available = viewportWidth - minWorkspaceWidth;
  const overflow = resourceWidth + inspectorWidth - available;

  if (overflow <= 0) {
    return { resourceWidth, inspectorWidth };
  }

  const resourceReduction = Math.max(
    0,
    Math.min(overflow, resourceWidth - resourceMinWidth),
  );
  const clampedResourceWidth = resourceWidth - resourceReduction;

  const remainingOverflow = overflow - resourceReduction;
  const clampedInspectorWidth =
    remainingOverflow > 0
      ? Math.max(inspectorMinWidth, inspectorWidth - remainingOverflow)
      : inspectorWidth;

  return {
    resourceWidth: clampedResourceWidth,
    inspectorWidth: clampedInspectorWidth,
  };
}
