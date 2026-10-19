// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "./contentSecurityPolicy";

function directive(name: string): string[] {
  const match = CONTENT_SECURITY_POLICY.split("; ").find((entry) =>
    entry.startsWith(`${name} `),
  );
  return match ? match.split(" ").slice(1) : [];
}

describe("CONTENT_SECURITY_POLICY", () => {
  it("only runs scripts from the bundle itself (plus Next's inline bootstrap)", () => {
    expect(directive("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
  });

  it("blocks plugins, base rewriting, form posts and being framed", () => {
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'none'"]);
    expect(directive("form-action")).toEqual(["'none'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
  });

  it("keeps network access for the app itself local", () => {
    expect(directive("default-src")).toEqual(["'self'"]);
    expect(directive("connect-src")).toEqual(["'self'"]);
  });

  it("lets user-authored media and iframes reference remote URLs but never local files", () => {
    for (const name of ["img-src", "media-src", "frame-src"]) {
      expect(directive(name)).toEqual(
        expect.arrayContaining(["http:", "https:"]),
      );
      expect(directive(name)).not.toContain("file:");
      expect(directive(name)).not.toContain("*");
    }
    expect(directive("frame-src")).not.toContain("'self'");
  });
});
