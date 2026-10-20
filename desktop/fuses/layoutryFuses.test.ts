// @vitest-environment node
import { FuseV1Options } from "@electron/fuses";
import { describe, expect, it } from "vitest";
import {
  ASAR_DEPENDENT_FUSES,
  PACKAGED_FUSES,
  UNPACKED_VERIFICATION_FUSES,
} from "./layoutryFuses";

const allFuses = Object.values(FuseV1Options).filter(
  (value): value is FuseV1Options => typeof value === "number",
);

describe("PACKAGED_FUSES", () => {
  it("decides every fuse the installed @electron/fuses knows about", () => {
    expect(PACKAGED_FUSES.strictlyRequireAllFuses).toBe(true);
    for (const fuse of allFuses) {
      expect(typeof PACKAGED_FUSES[fuse], FuseV1Options[fuse]).toBe("boolean");
    }
  });

  it("closes every Node.js entry point and extra file:// privilege", () => {
    expect(PACKAGED_FUSES[FuseV1Options.RunAsNode]).toBe(false);
    expect(
      PACKAGED_FUSES[FuseV1Options.EnableNodeOptionsEnvironmentVariable],
    ).toBe(false);
    expect(PACKAGED_FUSES[FuseV1Options.EnableNodeCliInspectArguments]).toBe(
      false,
    );
    expect(PACKAGED_FUSES[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(
      false,
    );
  });

  it("enforces ASAR-only loading with integrity validation once packaged", () => {
    expect(PACKAGED_FUSES[FuseV1Options.OnlyLoadAppFromAsar]).toBe(true);
    expect(
      PACKAGED_FUSES[FuseV1Options.EnableEmbeddedAsarIntegrityValidation],
    ).toBe(true);
  });
});

describe("UNPACKED_VERIFICATION_FUSES", () => {
  it("differs from the packaged set only in the ASAR-dependent fuses", () => {
    const asarDependent: readonly FuseV1Options[] = ASAR_DEPENDENT_FUSES;
    for (const fuse of allFuses) {
      const isAsarDependent = asarDependent.includes(fuse);
      expect(UNPACKED_VERIFICATION_FUSES[fuse], FuseV1Options[fuse]).toBe(
        isAsarDependent ? false : PACKAGED_FUSES[fuse],
      );
    }
  });
});
