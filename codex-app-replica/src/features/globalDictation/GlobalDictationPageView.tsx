import type { Ref } from "react";
import { RefreshIcon, SearchClearIcon } from "../../components/AppShellIcons";
import { Spinner } from "../../components/Spinner";

export type GlobalDictationStatus =
  | "starting"
  | "listening"
  | "transcribing"
  | "error";

export type GlobalDictationPageViewProps = {
  canRetry: boolean;
  dismissAriaLabel: string;
  errorMessage: string | null;
  liveStatusText: string | null;
  onDismiss: () => void;
  onRetry: () => void;
  onStop: () => void;
  retryAriaLabel: string;
  status: GlobalDictationStatus;
  waveformAriaLabel: string;
  waveformCanvasRef?: Ref<HTMLCanvasElement>;
};

export function GlobalDictationPageView({
  canRetry,
  dismissAriaLabel,
  errorMessage,
  liveStatusText,
  onDismiss,
  onRetry,
  onStop,
  retryAriaLabel,
  status,
  waveformAriaLabel,
  waveformCanvasRef,
}: GlobalDictationPageViewProps) {
  const pillBehaviorClassName =
    status === "listening" ? "no-drag cursor-interaction" : "draggable";
  const pillSizeClassName =
    status === "error" ? "w-fit max-w-[304px] gap-2" : "w-16 justify-center";
  const pillClassName = [
    "flex h-8 items-center rounded-full border border-token-border-default/80 bg-token-bg-primary/95 px-2 shadow-lg shadow-black/20 backdrop-blur-sm forced-colors:bg-[Canvas] forced-colors:backdrop-blur-none [@media(prefers-reduced-transparency:reduce)]:bg-token-bg-primary [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
    pillBehaviorClassName,
    pillSizeClassName,
  ].join(" ");

  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent p-1 text-token-text-primary">
      <section
        aria-label={waveformAriaLabel}
        aria-live="polite"
        className={pillClassName}
        onClick={onStop}
      >
        {status === "transcribing" ? (
          <Spinner className="icon-xs text-token-text-secondary" />
        ) : null}
        {status === "error" ? (
          <>
            <span className="max-w-[252px] min-w-0 truncate text-xs font-medium text-token-error-foreground">
              {errorMessage}
            </span>
            {canRetry ? (
              <button
                type="button"
                aria-label={retryAriaLabel}
                className="no-drag flex size-5 shrink-0 cursor-interaction items-center justify-center rounded-full text-token-text-secondary hover:bg-token-list-hover-background hover:text-token-text-primary focus:outline-none"
                onClick={onRetry}
              >
                <RefreshIcon className="icon-2xs" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={dismissAriaLabel}
              className="no-drag flex size-5 shrink-0 cursor-interaction items-center justify-center rounded-full text-token-text-secondary hover:bg-token-list-hover-background hover:text-token-text-primary focus:outline-none"
              onClick={onDismiss}
            >
              <SearchClearIcon className="icon-2xs" />
            </button>
          </>
        ) : null}
        {status === "starting" || status === "listening" ? (
          <canvas
            ref={waveformCanvasRef}
            aria-hidden="true"
            className="h-4 min-w-0 flex-1 text-token-text-primary"
          />
        ) : null}
        <span className="sr-only">{liveStatusText}</span>
      </section>
    </main>
  );
}
