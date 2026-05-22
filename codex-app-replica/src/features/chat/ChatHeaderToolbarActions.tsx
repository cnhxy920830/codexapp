import { PlusIcon, SearchIcon, MoreActionsIcon, CopyPathIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";

type ChatHeaderToolbarActionsProps = {
  onAttachFile?: () => void;
  onPasteFromClipboard?: () => void;
  onSearch?: () => void;
  onShowMore?: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function ChatHeaderToolbarActions({
  onAttachFile,
  onPasteFromClipboard,
  onSearch,
  onShowMore,
  t,
}: ChatHeaderToolbarActionsProps) {
  return (
    <div className="no-drag flex items-center gap-1">
      {onAttachFile ? (
        <button
          type="button"
          aria-label="Attach file"
          onClick={onAttachFile}
          className="app-topbar-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-control-bg)] hover:text-[var(--app-shell-text)]"
          title="Attach file"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      ) : null}
      {onPasteFromClipboard ? (
        <button
          type="button"
          aria-label="Paste from clipboard"
          onClick={onPasteFromClipboard}
          className="app-topbar-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-control-bg)] hover:text-[var(--app-shell-text)]"
          title="Paste from clipboard"
        >
          <CopyPathIcon className="h-5 w-5" />
        </button>
      ) : null}
      {onSearch ? (
        <button
          type="button"
          aria-label="Search"
          onClick={onSearch}
          className="app-topbar-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-control-bg)] hover:text-[var(--app-shell-text)]"
          title="Search"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      ) : null}
      {onShowMore ? (
        <button
          type="button"
          aria-label="More actions"
          onClick={onShowMore}
          className="app-topbar-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-control-bg)] hover:text-[var(--app-shell-text)]"
          title="More actions"
        >
          <MoreActionsIcon className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
