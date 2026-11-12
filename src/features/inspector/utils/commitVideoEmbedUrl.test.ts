import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIframeNode, createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import { selectHasUnsavedChanges, useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { commitVideoEmbedUrl, videoEmbedUrlErrorMessage } from "./commitVideoEmbedUrl";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const YT = "dQw4w9WgXcQ";
let embedId: string;
const node = () => findNodeById(store().document, embedId);

beforeEach(() => {
  const embed = createVideoEmbedNode();
  store().insertElement("page-root", embed);
  embedId = embed.id;
  store().markDocumentPersisted(store().document);
});

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

function expectUntouched(run: () => void) {
  const before = { document: store().document, past: store().past, future: store().future };
  run();
  expect(store().document).toBe(before.document);
  expect(store().past).toBe(before.past);
  expect(store().future).toBe(before.future);
}

describe("commitVideoEmbedUrl (BC-08.2)", () => {
  it("a valid link stores the canonical source and the provider's title as ONE Undo step", () => {
    const history = store().past.length;
    expect(commitVideoEmbedUrl(embedId, `https://www.youtube.com/watch?v=${YT}&si=abc`)).toEqual({ ok: true });
    expect(node()?.src).toBe(`https://www.youtube-nocookie.com/embed/${YT}`);
    expect(node()?.title).toBe("YouTube video");
    expect(store().past.length).toBe(history + 1);
    store().undo();
    expect(node()?.src).toBeUndefined();
    expect(node()?.title).toBe("Embedded video");
    store().redo();
    expect(node()?.src).toBe(`https://www.youtube-nocookie.com/embed/${YT}`);
  });

  it("approved decision 13: an invalid link keeps the last valid source, adds no history and does not mark the project changed", () => {
    commitVideoEmbedUrl(embedId, `https://youtu.be/${YT}`);
    store().markDocumentPersisted(store().document);
    for (const input of ["https://youtube.com.evil.example/watch?v=x", "javascript:alert(1)", "not a link", "https://www.twitch.tv/x", "http://youtu.be/" + YT]) {
      expectUntouched(() => expect(commitVideoEmbedUrl(embedId, input).ok).toBe(false));
    }
    expect(node()?.src).toBe(`https://www.youtube-nocookie.com/embed/${YT}`);
    expect(selectHasUnsavedChanges(store())).toBe(false);
  });

  it("the same video again changes nothing", () => {
    commitVideoEmbedUrl(embedId, `https://youtu.be/${YT}`);
    expectUntouched(() => expect(commitVideoEmbedUrl(embedId, `https://www.youtube.com/watch?v=${YT}`)).toEqual({ ok: true }));
  });

  it("switching provider is one Undo step and keeps the playback settings", () => {
    commitVideoEmbedUrl(embedId, `https://youtu.be/${YT}`);
    store().setElementMuted(embedId, true);
    store().setElementLoop(embedId, true);
    const history = store().past.length;
    expect(commitVideoEmbedUrl(embedId, `https://www.loom.com/share/${"a".repeat(32)}`)).toEqual({ ok: true });
    expect(store().past.length).toBe(history + 1);
    expect(node()).toMatchObject({ src: `https://www.loom.com/embed/${"a".repeat(32)}`, title: "Loom video", muted: true, loop: true, controls: true });
  });

  it("a title the user chose is never replaced", () => {
    store().setElementTitle(embedId, "Our product tour");
    commitVideoEmbedUrl(embedId, "https://vimeo.com/76979871");
    expect(node()?.title).toBe("Our product tour");
  });

  it("refuses to write to a generic Embed", () => {
    const generic = createIframeNode();
    store().insertElement("page-root", generic);
    expectUntouched(() => expect(commitVideoEmbedUrl(generic.id, `https://youtu.be/${YT}`).ok).toBe(false));
    expect(findNodeById(store().document, generic.id)?.src).toBeUndefined();
  });

  it("each refusal has a specific message", () => {
    expect(videoEmbedUrlErrorMessage("unknown-host")).toBe("That isn't a YouTube, Vimeo, Loom or Wistia link.");
    expect(videoEmbedUrlErrorMessage("invalid-id", "vimeo")).toBe("That Vimeo link has an invalid video ID.");
    expect(videoEmbedUrlErrorMessage("unsupported-path", "youtube")).toBe("That YouTube link isn't a single video. Paste the video's own link.");
    expect(videoEmbedUrlErrorMessage("deferred-provider", "twitch")).toMatch(/^Twitch videos aren't supported yet/);
    expect(videoEmbedUrlErrorMessage("deferred-provider", "dailymotion")).toMatch(/^Dailymotion videos aren't supported yet/);
    expect(videoEmbedUrlErrorMessage("not-https")).toBe("Use the video's https:// link.");
  });
});
