import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "@/lib/downloadTextFile";

describe("downloadTextFile", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("downloads the exact text under the given name and revokes the object URL afterwards", async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:layoutry/1";
    });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clicked: { download: string; href: string; attached: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href, attached: this.isConnected });
    });

    downloadTextFile("index.html", "<p>&amp;</p>\n", "text/html; charset=utf-8");

    expect(create).toHaveBeenCalledTimes(1);
    expect(blobs[0]?.type).toBe("text/html; charset=utf-8");
    expect(await blobs[0]?.text()).toBe("<p>&amp;</p>\n");
    expect(clicked).toEqual([{ download: "index.html", href: "blob:layoutry/1", attached: true }]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:layoutry/1");
  });

  it("removes the link and still revokes the URL when the click throws", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:layoutry/2");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => downloadTextFile("styles.css", "a{}", "text/css")).toThrow("blocked");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:layoutry/2");
  });
});
