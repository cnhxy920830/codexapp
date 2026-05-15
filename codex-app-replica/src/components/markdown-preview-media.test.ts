import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectMarkdownImagePreviewGallery,
  createMarkdownMediaDataUrl,
  getMarkdownMediaKind,
  getMarkdownMediaReadTarget,
  normalizeMarkdownMediaSource,
} from "./markdownPreviewMedia";

test("normalizeMarkdownMediaSource rejects unsafe schemes", () => {
  assert.equal(normalizeMarkdownMediaSource("javascript:alert(1)"), null);
  assert.equal(normalizeMarkdownMediaSource("data:text/html;base64,PHNjcmlwdD4="), null);
});

test("getMarkdownMediaKind detects remote and data-url video media", () => {
  assert.equal(getMarkdownMediaKind("https://example.com/demo.mp4"), "video");
  assert.equal(getMarkdownMediaKind("data:video/mp4;base64,AAAA"), "video");
  assert.equal(getMarkdownMediaKind("https://example.com/chart.png"), "image");
});

test("getMarkdownMediaReadTarget keeps relative media paths bound to notebook cwd", () => {
  assert.deepEqual(getMarkdownMediaReadTarget("./figures/plot.png", "D:\\workspace\\notebooks"), {
    cwd: "D:\\workspace\\notebooks",
    path: "./figures/plot.png",
  });
});

test("getMarkdownMediaReadTarget decodes file urls into filesystem paths", () => {
  assert.deepEqual(
    getMarkdownMediaReadTarget("file:///D:/workspace/notebooks/plot.png", null),
    {
      cwd: null,
      path: "D:/workspace/notebooks/plot.png",
    },
  );
});

test("createMarkdownMediaDataUrl uses mimeType from the host response when provided", () => {
  assert.equal(
    createMarkdownMediaDataUrl({
      contentsBase64: "YWJj",
      mimeType: "image/png",
      source: "./plot.png",
    }),
    "data:image/png;base64,YWJj",
  );
});

test("collectMarkdownImagePreviewGallery uses trigger order from the rendered markdown root", () => {
  const firstImage = createFakeMarkdownImageNode("https://example.com/one.png", "One");
  const secondImage = createFakeMarkdownImageNode("https://example.com/two.png", "Two");
  const firstTrigger = createFakeMarkdownImageTriggerNode(firstImage);
  const secondTrigger = createFakeMarkdownImageTriggerNode(secondImage);
  const root = {
    querySelectorAll: () => [firstTrigger, secondTrigger],
  };

  assert.deepEqual(
    collectMarkdownImagePreviewGallery({
      fallbackItem: { alt: "Fallback", src: "https://example.com/fallback.png" },
      root,
      trigger: secondTrigger,
    }),
    {
      index: 1,
      items: [
        { alt: "One", src: "https://example.com/one.png" },
        { alt: "Two", src: "https://example.com/two.png" },
      ],
    },
  );
});

test("collectMarkdownImagePreviewGallery falls back when the trigger is outside the root", () => {
  const root = {
    querySelectorAll: () => [createFakeMarkdownImageTriggerNode(createFakeMarkdownImageNode("https://example.com/one.png", "One"))],
  };

  assert.deepEqual(
    collectMarkdownImagePreviewGallery({
      fallbackItem: { alt: "Fallback", src: "https://example.com/fallback.png" },
      root,
      trigger: createFakeMarkdownImageTriggerNode(createFakeMarkdownImageNode("https://example.com/two.png", "Two")),
    }),
    {
      index: 0,
      items: [{ alt: "Fallback", src: "https://example.com/fallback.png" }],
    },
  );
});

function createFakeMarkdownImageNode(src: string, alt: string) {
  return {
    alt,
    currentSrc: src,
    getAttribute: (name: string) => (name === "src" ? src : null),
  };
}

function createFakeMarkdownImageTriggerNode(image: ReturnType<typeof createFakeMarkdownImageNode>) {
  return {
    querySelector: (selector: string) => (selector === "img" ? image : null),
  };
}
