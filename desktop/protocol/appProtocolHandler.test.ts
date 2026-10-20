// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "../security/contentSecurityPolicy";
import { contentTypeFor, createAppProtocolHandler } from "./appProtocolHandler";

let sandbox: string;
let exportRoot: string;
let handle: (request: Request) => Promise<Response>;

beforeAll(async () => {
  sandbox = await mkdtemp(path.join(os.tmpdir(), "layoutry-protocol-"));
  exportRoot = path.join(sandbox, "out");
  await mkdir(path.join(exportRoot, "_next", "static", "media"), {
    recursive: true,
  });
  await writeFile(
    path.join(exportRoot, "index.html"),
    "<!doctype html><title>Layoutry</title>",
  );
  await writeFile(
    path.join(exportRoot, "_next", "static", "app.js"),
    "console.log(1)",
  );
  await writeFile(
    path.join(exportRoot, "_next", "static", "media", "inter.woff2"),
    "woff2",
  );
  // A sibling of the export root that must never be reachable.
  await writeFile(path.join(sandbox, "secret.txt"), "secret");
  // Directory links (junctions on Windows — creatable without elevation):
  // one escaping the export, one pointing back inside it.
  await mkdir(path.join(sandbox, "outside"));
  await writeFile(path.join(sandbox, "outside", "leak.txt"), "leaked");
  await symlink(
    path.join(sandbox, "outside"),
    path.join(exportRoot, "escape"),
    "junction",
  );
  await symlink(
    path.join(exportRoot, "_next", "static"),
    path.join(exportRoot, "alias"),
    "junction",
  );

  handle = createAppProtocolHandler({
    exportRoot,
    fetchFile: async (filePath) => new Response(await readFile(filePath)),
  });
});

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

describe("createAppProtocolHandler", () => {
  it("serves index.html for the app root with the desktop CSP", async () => {
    const response = await handle(new Request("app://layoutry/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("Content-Security-Policy")).toBe(
      CONTENT_SECURITY_POLICY,
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toContain("<title>Layoutry</title>");
  });

  it("serves bundle assets with their MIME types", async () => {
    const script = await handle(
      new Request("app://layoutry/_next/static/app.js?v=1"),
    );
    expect(script.status).toBe(200);
    expect(script.headers.get("Content-Type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(await script.text()).toBe("console.log(1)");

    const font = await handle(
      new Request("app://layoutry/_next/static/media/inter.woff2"),
    );
    expect(font.headers.get("Content-Type")).toBe("font/woff2");
  });

  it("returns 404 for missing assets and for directories", async () => {
    expect(
      (await handle(new Request("app://layoutry/_next/static/missing.js")))
        .status,
    ).toBe(404);
    expect(
      (await handle(new Request("app://layoutry/_next/static"))).status,
    ).toBe(404);
  });

  it("returns 400 for traversal attempts and never serves files outside the export", async () => {
    const response = await handle(
      new Request("app://layoutry/..%2Fsecret.txt"),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("secret");
  });

  it("never follows a link that leads outside the export", async () => {
    const response = await handle(
      new Request("app://layoutry/escape/leak.txt"),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("leaked");
  });

  it("still serves a link whose real target stays inside the export", async () => {
    const response = await handle(new Request("app://layoutry/alias/app.js"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("console.log(1)");
  });

  it("returns 400 for malformed percent-encoding", async () => {
    expect((await handle(new Request("app://layoutry/%E0%A4%A"))).status).toBe(
      400,
    );
  });

  it("returns 404 instead of failing when the file read itself fails", async () => {
    const failing = createAppProtocolHandler({
      exportRoot,
      fetchFile: () => Promise.reject(new Error("read failed")),
    });
    expect((await failing(new Request("app://layoutry/"))).status).toBe(404);
  });

  it("returns 400 for other hosts", async () => {
    expect((await handle(new Request("app://other/index.html"))).status).toBe(
      400,
    );
  });

  it("allows HEAD without a body and rejects other methods", async () => {
    const head = await handle(
      new Request("app://layoutry/", { method: "HEAD" }),
    );
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();

    expect(
      (
        await handle(
          new Request("app://layoutry/", { method: "POST", body: "x" }),
        )
      ).status,
    ).toBe(405);
  });
});

describe("contentTypeFor", () => {
  it("falls back to an opaque type for unknown extensions", () => {
    expect(contentTypeFor("/out/file.unknown")).toBe(
      "application/octet-stream",
    );
    expect(contentTypeFor("/out/STYLE.CSS")).toBe("text/css; charset=utf-8");
  });
});
