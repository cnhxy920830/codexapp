import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import { CheckIcon, CopyPathIcon } from "./AppShellIcons";

type MermaidRuntimeModule = {
  applyMermaidSvgSizing: (svg: SVGSVGElement, actualSize: boolean) => void;
  detectMermaidDiagramKind: (source: string) => string | null;
  initializeMermaidRuntime: (container: HTMLElement, isDark: boolean) => {
    theme?: string | null;
  };
  mermaidApi: {
    parse: (source: string, options?: { suppressErrors?: boolean }) => Promise<boolean> | boolean;
    render: (diagramId: string, source: string) => Promise<{ svg: string }>;
  };
  sanitizeMermaidSource: (source: string) => string | undefined;
};

type MarkdownMermaidProps = {
  code: string;
  fallback: ReactNode;
};

let mermaidRuntimePromise: Promise<MermaidRuntimeModule> | null = null;

export function MarkdownMermaid({ code, fallback }: MarkdownMermaidProps) {
  const { t } = useI18n();
  const runtimeRef = useRef<MermaidRuntimeModule | null>(null);
  const visibilityRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isActualSize, setIsActualSize] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [failedRenderToken, setFailedRenderToken] = useState<string | null>(null);
  const isDark = useDocumentIsDark();
  const reactId = useId();
  const diagramId = useMemo(() => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const renderToken = useMemo(() => `${isDark ? "dark" : "light"}::${code}`, [code, isDark]);
  const toggleLabel = isActualSize ? t("mermaidDiagram.fitToWidth") : t("mermaidDiagram.viewActualSize");
  const copyLabel = t("mermaidDiagram.copySource");
  const renderFailed = failedRenderToken === renderToken;

  useEffect(() => {
    if (isVisible) {
      return;
    }

    const node = visibilityRef.current;
    if (node == null) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = window.setTimeout(() => {
        setIsVisible(true);
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setIsVisible(true);
        observer.disconnect();
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!copied || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  useEffect(() => {
    const svg = diagramRef.current?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) {
      return;
    }

    runtimeRef.current?.applyMermaidSvgSizing(svg, isActualSize);
  }, [isActualSize]);

  useEffect(() => {
    if (!isVisible || typeof window === "undefined") {
      return;
    }

    const container = diagramRef.current;
    if (container == null) {
      return;
    }

    let cancelled = false;
    container.innerHTML = "";
    setFailedRenderToken((currentValue) => (currentValue === renderToken ? null : currentValue));
    setIsActualSize(false);

    void (async () => {
      try {
        const runtime = await loadMermaidRuntime();
        if (cancelled) {
          return;
        }

        runtimeRef.current = runtime;
        const sanitizedCode = runtime.sanitizeMermaidSource(code);
        if (sanitizedCode == null || sanitizedCode.trim().length === 0) {
          container.innerHTML = "";
          setFailedRenderToken(renderToken);
          return;
        }

        const initializedTheme = runtime.initializeMermaidRuntime(container, isDark);
        const parseResult = await runtime.mermaidApi.parse(sanitizedCode, {
          suppressErrors: true,
        });
        if (cancelled) {
          return;
        }

        if (parseResult === false) {
          container.innerHTML = "";
          setFailedRenderToken(renderToken);
          return;
        }

        const { svg } = await runtime.mermaidApi.render(diagramId, sanitizedCode);
        if (cancelled) {
          return;
        }

        container.innerHTML = svg;
        const svgElement = container.querySelector("svg");
        if (!(svgElement instanceof SVGSVGElement)) {
          container.innerHTML = "";
          setFailedRenderToken(renderToken);
          return;
        }

        runtime.applyMermaidSvgSizing(svgElement, false);
        container.setAttribute("data-mermaid-theme", initializedTheme.theme ?? "");
        const diagramKind = runtime.detectMermaidDiagramKind(sanitizedCode);
        if (diagramKind == null) {
          container.removeAttribute("data-mermaid-diagram");
        } else {
          container.setAttribute("data-mermaid-diagram", diagramKind);
        }

        setFailedRenderToken(null);
      } catch {
        if (cancelled) {
          return;
        }

        container.innerHTML = "";
        setFailedRenderToken(renderToken);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, diagramId, isDark, isVisible, renderToken]);

  if (renderFailed) {
    return (
      <div data-wide-markdown-block="true" data-wide-markdown-block-kind="mermaid">
        {fallback}
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div ref={visibilityRef} data-wide-markdown-block="true" data-wide-markdown-block-kind="mermaid">
        <pre className="text-size-chat overflow-x-auto rounded-lg border border-token-input-background bg-token-text-code-block-background/10 p-2">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div data-wide-markdown-block="true" data-wide-markdown-block-kind="mermaid">
      <div className="relative">
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            aria-label={toggleLabel}
            aria-pressed={isActualSize}
            className={[
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
              isActualSize
                ? "bg-token-toolbar-hover-background text-token-text-primary"
                : "text-token-text-tertiary hover:bg-token-list-hover-background hover:text-token-text-primary",
            ].join(" ")}
            title={toggleLabel}
            type="button"
            onClick={() => {
              setIsActualSize((currentValue) => !currentValue);
            }}
          >
            {isActualSize ? <MermaidActualSizeIcon className="icon-2xs" /> : <MermaidFitWidthIcon className="icon-2xs" />}
          </button>
          <button
            aria-label={copied ? copyLabel : copyLabel}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-token-text-tertiary transition hover:bg-token-list-hover-background hover:text-token-text-primary"
            title={copyLabel}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
                return;
              }

              const source = ["```mermaid", code, "```"].join("\n");
              void navigator.clipboard.writeText(source).then(
                () => {
                  setCopied(true);
                },
                () => {},
              );
            }}
          >
            {copied ? <CheckIcon className="icon-xs" /> : <CopyPathIcon className="icon-xs" />}
          </button>
        </div>
        <div
          ref={diagramRef}
          aria-label={t("mermaidDiagram.ariaLabel")}
          className={[
            "relative rounded-lg border border-token-input-background bg-token-text-code-block-background/10 px-4 py-3 [&>svg]:h-auto [&>svg]:text-left",
            isActualSize ? "max-h-[var(--markdown-wide-block-max-height)] overflow-auto" : "overflow-x-auto",
          ].join(" ")}
          role="img"
        />
        <span className="sr-only">{t("mermaidDiagram.originalCode")}</span>
        <pre className="sr-only whitespace-pre-wrap">{code}</pre>
      </div>
    </div>
  );
}

function MermaidActualSizeIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16.0299 3.0293C16.2896 2.76996 16.7107 2.76988 16.9703 3.0293C17.23 3.28899 17.23 3.711 16.9703 3.9707L13.2731 7.66797H16.9996L17.1344 7.68164C17.4372 7.74375 17.6645 8.01192 17.6647 8.33301C17.6647 8.65421 17.4372 8.92219 17.1344 8.98438L16.9996 8.99805H11.6666C11.2994 8.99801 11.0016 8.70026 11.0016 8.33301V3C11.0016 2.63275 11.2994 2.33499 11.6666 2.33496C12.0339 2.33496 12.3317 2.63273 12.3317 3V6.72754L16.0299 3.0293ZM8.99475 17C8.99475 17.3673 8.69698 17.665 8.32971 17.665C7.96258 17.6649 7.66467 17.3672 7.66467 17V13.2725L3.96741 16.9707C3.70771 17.2304 3.2857 17.2304 3.026 16.9707C2.7663 16.711 2.7663 16.289 3.026 16.0293L6.72424 12.332H2.9967C2.62955 12.332 2.33185 12.0341 2.33167 11.667C2.33167 11.2997 2.62943 11.002 2.9967 11.002H8.32971C8.69698 11.002 8.99475 11.2997 8.99475 11.667V17Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MermaidFitWidthIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4.33496 11C4.33496 10.6327 4.63273 10.335 5 10.335C5.36727 10.335 5.66504 10.6327 5.66504 11V14.335H9L9.13379 14.3486C9.43692 14.4106 9.66504 14.6786 9.66504 15C9.66504 15.3214 9.43692 15.5894 9.13379 15.6514L9 15.665H5C4.63273 15.665 4.33496 15.3673 4.33496 15V11ZM14.335 9V5.66504H11C10.6327 5.66504 10.335 5.36727 10.335 5C10.335 4.63273 10.6327 4.33496 11 4.33496H15L15.1338 4.34863C15.4369 4.41057 15.665 4.67857 15.665 5V9C15.665 9.36727 15.3673 9.66504 15 9.66504C14.6327 9.66504 14.335 9.36727 14.335 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function useDocumentIsDark() {
  const [isDark, setIsDark] = useState(readDocumentIsDark);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(readDocumentIsDark());
    });

    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia == null) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setIsDark(readDocumentIsDark());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isDark;
}

function readDocumentIsDark() {
  if (typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  if (root.classList.contains("electron-dark")) {
    return true;
  }
  if (root.classList.contains("electron-light")) {
    return false;
  }

  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

async function loadMermaidRuntime() {
  mermaidRuntimePromise ??= import("../utils/mermaidWrapper") as Promise<MermaidRuntimeModule>;
  return mermaidRuntimePromise;
}
