import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import {
  readWorkspaceFile,
  searchWorkspaceFiles,
  type WorkspaceFileDocument,
  type WorkspaceFileSearchResult,
} from "../../services/workspaceFiles";

type WorkspaceFileSearchDialogProps = {
  isOpen: boolean;
  workspaceRoot: string | null;
  onClose: () => void;
  onSelectFile: (file: WorkspaceFileDocument) => void;
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
  const [isOpeningFile, setIsOpeningFile] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setIsOpeningFile(false);
    }
  }, [isOpen]);

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

  const canSearch = workspaceRoot !== null;
  const heading = useMemo(() => t("thread.fileCommandMenu.filesGroup"), [t]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[640px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[15px] font-medium">{t("thread.sidePanel.openFile")}</div>
          <button
            type="button"
            onClick={onClose}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("threadHeader.archiveConfirmCancel")}
          </button>
        </div>

        <input
          autoFocus
          disabled={!canSearch || isOpeningFile}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("thread.fileCommandMenu.searchFiles")}
          placeholder={t("thread.fileCommandMenu.searchFiles")}
          className="app-control app-text-input mt-4 w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
        />

        <div className="mt-4">
          <div className="app-text-muted px-1 text-[12px] font-medium tracking-[0.16em]">{heading}</div>
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
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.relativePath}
                    type="button"
                    disabled={isOpeningFile}
                    onClick={() => {
                      if (!workspaceRoot) {
                        return;
                      }
                      setIsOpeningFile(true);
                      void readWorkspaceFile({
                        workspaceRoot,
                        relativePath: result.relativePath,
                      })
                        .then((file) => {
                          onSelectFile(file);
                        })
                        .catch((error) => {
                          onError(error instanceof Error ? error.message : String(error));
                        })
                        .finally(() => {
                          setIsOpeningFile(false);
                        });
                    }}
                    className="app-nav-item-idle flex w-full items-start rounded-[12px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                  >
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
