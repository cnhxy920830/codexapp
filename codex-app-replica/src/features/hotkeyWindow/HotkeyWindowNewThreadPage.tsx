import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { HomepageLogo } from "../../components/HomepageLogo";
import { useI18n } from "../../i18n/i18n";
import type { ComposerEnterBehavior } from "../../services/settings";

export function HotkeyWindowNewThreadPage({
  composerEnterBehavior,
  onSubmit,
}: {
  composerEnterBehavior: ComposerEnterBehavior;
  onSubmit: (draft: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submitDraft = async () => {
    const nextDraft = draft.trim();
    if (nextDraft.length === 0 || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(nextDraft);
    } catch (error) {
      const nextError = getErrorMessage(error);
      setError(nextError.length > 0 ? nextError : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      aria-label={t("threadPage.newThread")}
      className="h-full [--padding-panel:calc(var(--padding-panel-base)/2)]"
      role="main"
    >
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center px-panel">
          <div className="flex flex-col items-center gap-3 text-center">
            <div aria-hidden="true">
              <HomepageLogo className="h-12 w-12 text-token-foreground/20" />
            </div>
            <div className="heading-xl mt-2 font-normal text-token-foreground select-none">
              {t("home.hero.letsBuild")}
            </div>
          </div>
        </div>

        <div className="px-panel pb-panel">
          <div className="mx-auto w-full max-w-3xl">
            <div className="app-card overflow-hidden rounded-[18px]">
              <div className="px-4 pt-4 pb-3">
                <textarea
                  ref={textareaRef}
                  className="app-text-input min-h-[112px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    if (event.shiftKey) {
                      return;
                    }

                    const hasMultilineContent = draft.includes("\n");
                    if (composerEnterBehavior === "enter" || !hasMultilineContent) {
                      event.preventDefault();
                      void submitDraft();
                    }
                  }}
                  placeholder={t("app.chat.composePlaceholder")}
                  rows={4}
                  value={draft}
                />
              </div>

              <div className="border-t border-[var(--app-shell-border)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      error ? "app-text-error" : "app-text-subtle",
                      "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5",
                    ].join(" ")}
                  >
                    {error}
                  </div>
                  <Button
                    color="primary"
                    disabled={draft.trim().length === 0}
                    loading={isSubmitting}
                    size="medium"
                    onClick={() => void submitDraft()}
                  >
                    {t("app.chat.send")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "";
}
