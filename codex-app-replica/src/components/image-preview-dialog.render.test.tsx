import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImagePreviewDialog } from "./ImagePreviewDialog";
import { I18N_CONTEXT } from "../i18n/i18n";
import type { ReactElement, ReactNode } from "react";

test("ImagePreviewDialog trigger exposes dialog ARIA state when closed", () => {
  const markup = renderImagePreviewDialog(
    <ImagePreviewDialog
      alt="Example image"
      onOpenChange={() => undefined}
      open={false}
      src="https://example.com/image.png"
      triggerContent={<button type="button">Open preview</button>}
    />,
  );

  assert.match(markup, /aria-haspopup="dialog"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-controls="[^"]+"/);
});

test("ImagePreviewDialog trigger exposes expanded state when open", () => {
  const markup = renderImagePreviewDialog(
    <ImagePreviewDialog
      alt="Example image"
      onOpenChange={() => undefined}
      open={true}
      src="https://example.com/image.png"
      triggerContent={<button type="button">Open preview</button>}
    />,
  );

  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, /aria-controls="[^"]+"/);
});

function renderImagePreviewDialog(element: ReactElement) {
  return renderToStaticMarkup(<StaticI18nProvider>{element}</StaticI18nProvider>);
}

function StaticI18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: "en-US",
        setLocale: () => undefined,
        t: (key) => key,
      }}
    >
      {children}
    </I18N_CONTEXT.Provider>
  );
}
