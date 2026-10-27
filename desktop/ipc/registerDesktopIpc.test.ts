// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EVENT_CHANNELS, INVOKE_CHANNELS } from "./channels";
import {
  isTrustedSender,
  registerDesktopIpc,
  type DesktopIpcEvent,
} from "./registerDesktopIpc";

type Handler = (event: DesktopIpcEvent, ...args: unknown[]) => unknown;

function fakeWindow() {
  const mainFrame = { url: "app://layoutry/" };
  const webContents = { id: 3, mainFrame };
  return {
    window: { isDestroyed: () => false, webContents },
    mainFrame,
    webContents,
  };
}

function setup() {
  const handlers = new Map<string, Handler>();
  const { window, mainFrame, webContents } = fakeWindow();
  const files = {
    open: vi.fn(async () => ({ status: "cancelled" as const })),
    takePending: vi.fn(async () => ({ status: "none" as const })),
    chooseSaveLocation: vi.fn(async () => ({ status: "cancelled" as const })),
    write: vi.fn(async () => ({
      status: "saved" as const,
      fileName: "a.layoutry",
    })),
    release: vi.fn(),
  };
  const close = { reportUnsaved: vi.fn(), respond: vi.fn() };
  const recovery = {
    beginSession: vi.fn(() => ({ sessionId: "s" })),
    write: vi.fn(async () => ({ status: "stale" as const })),
    list: vi.fn(async () => ({ status: "ok" as const, entries: [] })),
    read: vi.fn(async () => ({
      status: "error" as const,
      error: { code: "not-found", message: "" },
    })),
    discard: vi.fn(async () => ({ status: "ok" as const, removed: 0 })),
  };
  registerDesktopIpc({
    ipcMain: {
      handle: (channel, handler) => void handlers.set(channel, handler),
    },
    getMainWindow: () => window,
    files,
    close,
    recovery,
  });
  const trusted: DesktopIpcEvent = {
    sender: webContents,
    senderFrame: mainFrame,
  };
  const call = (
    channel: string,
    event: DesktopIpcEvent,
    ...args: unknown[]
  ) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return Promise.resolve().then(() => handler(event, ...args));
  };
  return {
    handlers,
    files,
    close,
    recovery,
    trusted,
    call,
    webContents,
    mainFrame,
  };
}

describe("desktop IPC surface", () => {
  it("handles exactly the twelve allowlisted channels", () => {
    const { handlers } = setup();
    expect([...handlers.keys()].sort()).toEqual(
      Object.values(INVOKE_CHANNELS).sort(),
    );
    expect(handlers.size).toBe(12);
  });

  it("routes recovery calls with the window id as the session owner", async () => {
    const { call, trusted, recovery } = setup();
    await call(INVOKE_CHANNELS.beginRecoverySession, trusted);
    expect(recovery.beginSession).toHaveBeenCalledWith(3, undefined);
    await call(INVOKE_CHANNELS.writeRecoverySnapshot, trusted, { g: 1 });
    expect(recovery.write).toHaveBeenCalledWith(3, { g: 1 });
    await call(INVOKE_CHANNELS.listRecovery, trusted);
    expect(recovery.list).toHaveBeenCalledWith(3, undefined);
    await call(INVOKE_CHANNELS.readRecovery, trusted, { recordId: "r" });
    expect(recovery.read).toHaveBeenCalledWith(3, { recordId: "r" });
    await call(INVOKE_CHANNELS.discardRecovery, trusted, { recordIds: [] });
    expect(recovery.discard).toHaveBeenCalledWith(3, { recordIds: [] });
  });

  it("refuses recovery calls from anything but the editor's top frame", async () => {
    const { call, webContents, recovery } = setup();
    const subframe = { url: "app://layoutry/" };
    for (const channel of [
      INVOKE_CHANNELS.beginRecoverySession,
      INVOKE_CHANNELS.listRecovery,
      INVOKE_CHANNELS.readRecovery,
      INVOKE_CHANNELS.discardRecovery,
    ])
      await expect(
        call(channel, { sender: webContents, senderFrame: subframe }),
      ).rejects.toThrow("not allowed");
    expect(recovery.beginSession).not.toHaveBeenCalled();
    expect(recovery.discard).not.toHaveBeenCalled();
  });

  it("routes each call with the sender's window id as the capability owner", async () => {
    const { call, trusted, files, close } = setup();
    await call(INVOKE_CHANNELS.openProjectFile, trusted);
    expect(files.open).toHaveBeenCalledWith(3);
    await call(INVOKE_CHANNELS.writeProjectFile, trusted, { token: "t" });
    expect(files.write).toHaveBeenCalledWith(3, { token: "t" });
    await call(INVOKE_CHANNELS.setUnsavedChanges, trusted, { unsaved: true });
    expect(close.reportUnsaved).toHaveBeenCalledWith(true);
    await call(INVOKE_CHANNELS.respondToCloseRequest, trusted, {
      close: false,
    });
    expect(close.respond).toHaveBeenCalledWith(false);
  });

  it("refuses callers other than the editor's own top frame", async () => {
    const { call, webContents, mainFrame, files } = setup();
    const subframe = { url: "app://layoutry/" };
    const cases: DesktopIpcEvent[] = [
      { sender: webContents, senderFrame: subframe },
      { sender: { id: 99, mainFrame }, senderFrame: mainFrame },
      { sender: webContents, senderFrame: null },
    ];
    for (const event of cases)
      await expect(
        call(INVOKE_CHANNELS.openProjectFile, event),
      ).rejects.toThrow("not allowed");
    mainFrame.url = "https://example.com/";
    await expect(
      call(INVOKE_CHANNELS.openProjectFile, {
        sender: webContents,
        senderFrame: mainFrame,
      }),
    ).rejects.toThrow("not allowed");
    expect(files.open).not.toHaveBeenCalled();
  });

  it("rejects extra arguments and malformed payloads", async () => {
    const { call, trusted, close, files } = setup();
    await expect(
      call(INVOKE_CHANNELS.openProjectFile, trusted, "C:\\x.layoutry"),
    ).rejects.toThrow();
    await expect(
      call(INVOKE_CHANNELS.writeProjectFile, trusted, {}, {}),
    ).rejects.toThrow("unexpected arguments");
    await expect(
      call(INVOKE_CHANNELS.setUnsavedChanges, trusted, { unsaved: "yes" }),
    ).rejects.toThrow();
    await expect(
      call(INVOKE_CHANNELS.setUnsavedChanges, trusted, { unsaved: true, x: 1 }),
    ).rejects.toThrow();
    await expect(
      call(INVOKE_CHANNELS.respondToCloseRequest, trusted, true),
    ).rejects.toThrow();
    expect(close.reportUnsaved).not.toHaveBeenCalled();
    expect(files.open).not.toHaveBeenCalled();
  });

  it("isTrustedSender rejects a destroyed or missing window", () => {
    const { trusted } = setup();
    expect(isTrustedSender(trusted, null)).toBe(false);
    expect(
      isTrustedSender(trusted, {
        isDestroyed: () => true,
        webContents: trusted.sender,
      }),
    ).toBe(false);
  });
});

describe("preload", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "preload", "preload.ts"),
    "utf8",
  );

  it("uses exactly the channel names the main process handles", () => {
    for (const channel of [
      ...Object.values(INVOKE_CHANNELS),
      ...Object.values(EVENT_CHANNELS),
    ])
      expect(source).toContain(`"${channel}"`);
    const declared = [...source.matchAll(/"(layoutry:[a-z-]+:[a-z-]+)"/g)].map(
      (match) => match[1],
    );
    expect(new Set(declared)).toEqual(
      new Set([
        ...Object.values(INVOKE_CHANNELS),
        ...Object.values(EVENT_CHANNELS),
      ]),
    );
  });

  it("imports nothing but electron (sandboxed preloads can't load other modules)", () => {
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map(
      (match) => match[1],
    );
    expect(imports).toEqual(["electron"]);
    expect(source).not.toMatch(/require\(/);
  });

  it("exposes functions only, never ipcRenderer itself", async () => {
    const exposed: Record<string, unknown> = {};
    const invoke = vi.fn(() => Promise.resolve("ok"));
    vi.resetModules();
    vi.doMock("electron", () => ({
      contextBridge: {
        exposeInMainWorld: (key: string, api: unknown) => {
          exposed[key] = api;
        },
      },
      ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() },
    }));
    await import("../preload/preload");
    const api = exposed.layoutryDesktop;
    if (typeof api !== "object" || api === null) throw new Error("not exposed");
    expect(Object.isFrozen(api)).toBe(true);
    for (const [key, value] of Object.entries(api))
      expect([key, typeof value]).toEqual([
        key,
        key === "apiVersion" ? "number" : "function",
      ]);

    expect(Object.keys(api).sort()).toEqual(
      [
        "apiVersion",
        "openProjectFile",
        "takePendingProjectFile",
        "chooseSaveLocation",
        "writeProjectFile",
        "releaseProjectFile",
        "setUnsavedChanges",
        "respondToCloseRequest",
        "beginRecoverySession",
        "writeRecoverySnapshot",
        "listRecovery",
        "readRecovery",
        "discardRecovery",
        "onCloseRequested",
        "onPendingProjectFile",
      ].sort(),
    );

    const writeRecoverySnapshot = Reflect.get(api, "writeRecoverySnapshot");
    // Only the known fields cross the bridge; anything extra is dropped.
    await writeRecoverySnapshot({
      generation: 2,
      source: {
        kind: "file",
        token: "t",
        fileName: "a.layoutry",
        path: "C:\\",
      },
      sha256: "h",
      text: "{}",
      extra: "dropped",
    });
    expect(invoke).toHaveBeenLastCalledWith(
      INVOKE_CHANNELS.writeRecoverySnapshot,
      {
        generation: 2,
        source: { kind: "file", token: "t", fileName: "a.layoutry" },
        sha256: "h",
        text: "{}",
      },
    );
    expect(() =>
      writeRecoverySnapshot({
        generation: 1.5,
        source: {},
        sha256: "",
        text: "",
      }),
    ).toThrow(TypeError);
    const discardRecovery = Reflect.get(api, "discardRecovery");
    expect(() => discardRecovery("x")).toThrow(TypeError);

    const writeProjectFile = Reflect.get(api, "writeProjectFile");
    expect(() => writeProjectFile("t", 5, false)).toThrow(TypeError);
    await writeProjectFile("t", "text", true);
    expect(invoke).toHaveBeenLastCalledWith(INVOKE_CHANNELS.writeProjectFile, {
      token: "t",
      text: "text",
      force: true,
    });
    vi.doUnmock("electron");
  });
});
