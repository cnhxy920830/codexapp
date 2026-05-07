import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import { WorkspaceFileIcon } from "../../components/AppShellIcons";
import {
  searchWorkspaceFiles,
  type WorkspaceFilePreviewTarget,
  type WorkspaceFileSearchResult,
} from "../../services/workspaceFiles";

type WorkspaceFileSearchDialogProps = {
  isOpen: boolean;
  workspaceRoot: string | null;
  onClose: () => void;
  onSelectFile: (file: WorkspaceFilePreviewTarget) => void;
  onError: (message: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function WorkspaceFileSearchDialog({
  isOpen,
  workspaceRoot,
  onClose,
  onSelectFile,
  onError,
  t,
}: WorkspaceFileSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceFileSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedIndex(-1);
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen || !workspaceRoot) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void searchWorkspaceFiles({ workspaceRoot, query })
      .then((nextResults) => {
        if (!cancelled) {
          setResults(nextResults);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : String(error));
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, onError, query, workspaceRoot]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (results.length === 0) {
      setSelectedIndex(-1);
      return;
    }

    setSelectedIndex((current) => (current < 0 || current >= results.length ? 0 : current));
  }, [isOpen, results]);

  useEffect(() => {
    if (!isOpen || selectedIndex < 0) {
      return;
    }

    optionRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (results.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current < 0 ? 0 : (current + 1) % results.length));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) =>
          current < 0 ? results.length - 1 : (current - 1 + results.length) % results.length,
        );
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setSelectedIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setSelectedIndex(results.length - 1);
        return;
      }

      if (event.key === "Enter" && selectedIndex >= 0) {
        event.preventDefault();
        const result = results[selectedIndex];
        if (result && workspaceRoot) {
          onSelectFile({
            ...result,
            workspaceRoot,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, onSelectFile, results, selectedIndex, workspaceRoot]);

  const canSearch = workspaceRoot !== null;
  const heading = useMemo(() => t("thread.fileCommandMenu.filesGroup"), [t]);
  const resultsListId = "workspace-file-search-results";

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-20 bg-transparent"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="app-card absolute top-14 right-4 w-[340px] max-w-[calc(100vw-2rem)] rounded-[18px] px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <input
          autoFocus
          disabled={!canSearch}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("thread.fileCommandMenu.searchFiles")}
          aria-autocomplete="list"
          aria-controls={resultsListId}
          aria-expanded={results.length > 0}
          aria-activedescendant={selectedIndex >= 0 ? `workspace-file-search-option-${selectedIndex}` : undefined}
          placeholder={t("thread.fileCommandMenu.searchFiles")}
          className="app-control app-text-input w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
        />

        <div className="mt-3">
          <div className="app-text-muted px-1 text-[11px] font-medium tracking-[0.16em]">{heading}</div>
          <div className="mt-2 max-h-[420px] overflow-y-auto">
            {!canSearch ? (
              <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
                {t("thread.fileTreePanel.noMatchingFiles")}
              </div>
            ) : isLoading ? (
              <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
                {t("thread.fileTreePanel.searchingFiles")}
              </div>
            ) : results.length === 0 ? (
              <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
                {t("thread.fileTreePanel.noMatchingFiles")}
              </div>
            ) : (
              <div id={resultsListId} role="listbox" aria-label={heading} className="space-y-1">
                {results.map((result, index) => (
                  <button
                    key={result.relativePath}
                    id={`workspace-file-search-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selectedIndex === index}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      if (!workspaceRoot) {
                        return;
                      }
                      onSelectFile({
                        ...result,
                        workspaceRoot,
                      });
                    }}
                    className={`flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13px] ${
                      selectedIndex === index ? "app-nav-item-active" : "app-nav-item-idle"
                    }`}
                  >
                    <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{result.name}</div>
                      <div className="app-text-muted mt-1 truncate text-[12px]">{result.relativePath}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
