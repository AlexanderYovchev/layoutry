// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { hardenSession } from "./hardenSession";

function setup() {
  const session = {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    setDevicePermissionHandler: vi.fn(),
  };
  hardenSession(session);
  return session;
}

describe("hardenSession", () => {
  it.each([
    "media",
    "geolocation",
    "notifications",
    "fullscreen",
    "openExternal",
    "clipboard-read",
    "unknown",
  ])("denies a %s permission request", (permission) => {
    const session = setup();
    const handler = session.setPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();
    handler(null, permission, callback, {});
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("denies permission checks and device access", () => {
    const session = setup();
    expect(
      session.setPermissionCheckHandler.mock.calls[0][0](
        null,
        "media",
        "https://example.com",
        {},
      ),
    ).toBe(false);
    expect(
      session.setDevicePermissionHandler.mock.calls[0][0]({
        deviceType: "usb",
      }),
    ).toBe(false);
  });
});
