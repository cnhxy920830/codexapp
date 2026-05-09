import { useI18n } from "../i18n/i18n";
import type { MarketplaceLoadErrorInfo } from "../services/plugins";

export type AddMarketplaceDraft = {
  source: string;
  refName: string;
  sparsePaths: string;
};

export function AddMarketplaceDialog({
  draft,
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
  sourceError,
}: {
  draft: AddMarketplaceDraft;
  error: string | null;
  isSubmitting: boolean;
  onChange: (draft: AddMarketplaceDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
  sourceError: string | null;
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-label={t("skills.appsPage.addMarketplace.title")}
        aria-modal="true"
        className="app-card w-full max-w-[520px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        role="dialog"
      >
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="text-[16px] font-medium">{t("skills.appsPage.addMarketplace.header")}</div>
          <div className="app-text-muted mt-1 text-[13px] leading-6">{t("skills.appsPage.addMarketplace.subtitle")}</div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px]">
              <span>{t("skills.appsPage.addMarketplace.sourceLabel")}</span>
              <input
                value={draft.source}
                disabled={isSubmitting}
                onChange={(event) => onChange({ ...draft, source: event.target.value })}
                placeholder={t("skills.appsPage.addMarketplace.sourcePlaceholder")}
                className="app-control app-text-input rounded-[12px] px-3 py-2 text-[13px] outline-none"
                type="text"
              />
              {sourceError ? <span className="text-[12px] text-[var(--app-shell-error-text)]">{sourceError}</span> : null}
            </label>

            <label className="flex flex-col gap-1.5 text-[13px]">
              <span>{t("skills.appsPage.addMarketplace.refLabel")}</span>
              <input
                value={draft.refName}
                disabled={isSubmitting}
                onChange={(event) => onChange({ ...draft, refName: event.target.value })}
                placeholder={t("skills.appsPage.addMarketplace.refPlaceholder")}
                className="app-control app-text-input rounded-[12px] px-3 py-2 text-[13px] outline-none"
                type="text"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-[13px]">
              <span>{t("skills.appsPage.addMarketplace.sparsePathsLabel")}</span>
              <textarea
                value={draft.sparsePaths}
                disabled={isSubmitting}
                onChange={(event) => onChange({ ...draft, sparsePaths: event.target.value })}
                placeholder={t("skills.appsPage.addMarketplace.sparsePathsPlaceholder")}
                className="app-control app-text-input min-h-20 resize-y rounded-[12px] px-3 py-2 text-[13px] outline-none"
              />
            </label>

            {error ? <div className="text-[13px] text-[var(--app-shell-error-text)]">{error}</div> : null}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {t("skills.appsPage.addMarketplace.cancel")}
            </button>
            <button
              type="submit"
              disabled={draft.source.trim().length === 0 || isSubmitting}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {t("skills.appsPage.addMarketplace.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RemoveMarketplaceDialog({
  isRemoving,
  marketplaceName,
  onClose,
  onConfirm,
}: {
  isRemoving: boolean;
  marketplaceName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-label={t("skills.appsPage.marketplace.removeDialog.title", { marketplaceName })}
        aria-modal="true"
        className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        role="dialog"
      >
        <div className="text-[15px] font-medium">
          {t("skills.appsPage.marketplace.removeDialog.title", {
            marketplaceName,
          })}
        </div>
        <div className="app-text-muted mt-2 text-[13px] leading-6">
          {t("skills.appsPage.marketplace.removeDialog.description")}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isRemoving}
            onClick={onClose}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("skills.appsPage.marketplace.removeDialog.cancel")}
          </button>
          <button
            type="button"
            disabled={isRemoving}
            onClick={onConfirm}
            className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("skills.appsPage.marketplace.removeDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MarketplaceLoadErrorsBanner({
  errors,
  isRetrying,
  onRetry,
}: {
  errors: MarketplaceLoadErrorInfo[];
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const visibleErrors = errors.slice(0, 3);
  const remainingErrors = errors.length - visibleErrors.length;

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-muted)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{t("skills.appsPage.marketplace.partialLoadError.title")}</div>
          <div className="app-text-muted mt-2 flex flex-col gap-2 text-[12px] leading-5">
            {visibleErrors.map((error, index) => (
              <div key={`${error.marketplacePath}:${index}`} className="min-w-0">
                <div className="truncate font-mono">{error.marketplacePath}</div>
                <div className="break-words">{error.message}</div>
              </div>
            ))}
            {remainingErrors > 0 ? (
              <div>{t("skills.appsPage.marketplace.partialLoadError.more", { count: remainingErrors })}</div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          disabled={isRetrying}
          onClick={onRetry}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {t("skills.appsPage.marketplace.partialLoadError.retry")}
        </button>
      </div>
    </div>
  );
}

export function LoadErrorPanel({
  error,
  onRetry,
  retryLabel,
  title,
}: {
  error: string;
  onRetry: () => void;
  retryLabel: string;
  title: string;
}) {
  return (
    <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
      <div className="font-medium">{title}</div>
      <div className="app-text-muted mt-1 text-[12px]">{error}</div>
      <button
        type="button"
        onClick={onRetry}
        className="app-control mt-3 rounded-[11px] px-3 py-1.5 text-[12px]"
      >
        {retryLabel}
      </button>
    </div>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10.6299 1.33496C12.0335 1.33496 13.2695 2.25996 13.666 3.60645L13.8809 4.33496H17L17.1338 4.34863C17.4369 4.41057 17.665 4.67858 17.665 5C17.665 5.32142 17.4369 5.58943 17.1338 5.65137L17 5.66504H16.6543L15.8574 14.9912C15.7177 16.629 14.3478 17.8877 12.7041 17.8877H7.2959C5.75502 17.8877 4.45439 16.7815 4.18262 15.2939L4.14258 14.9912L3.34668 5.66504H3C2.63273 5.66504 2.33496 5.36727 2.33496 5C2.33496 4.63273 2.63273 4.33496 3 4.33496H6.11914L6.33398 3.60645L6.41797 3.3584C6.88565 2.14747 8.05427 1.33496 9.37012 1.33496H10.6299ZM5.46777 14.8779L5.49121 15.0537C5.64881 15.9161 6.40256 16.5576 7.2959 16.5576H12.7041C13.6571 16.5576 14.4512 15.8275 14.5322 14.8779L15.3193 5.66504H4.68164L5.46777 14.8779ZM7.66797 12.8271V8.66016C7.66797 8.29299 7.96588 7.99528 8.33301 7.99512C8.70028 7.99512 8.99805 8.29289 8.99805 8.66016V12.8271C8.99779 13.1942 8.70012 13.4912 8.33301 13.4912C7.96604 13.491 7.66823 13.1941 7.66797 12.8271ZM11.002 12.8271V8.66016C11.002 8.29289 11.2997 7.99512 11.667 7.99512C12.0341 7.9953 12.332 8.293 12.332 8.66016V12.8271C12.3318 13.1941 12.0339 13.491 11.667 13.4912C11.2999 13.4912 11.0022 13.1942 11.002 12.8271ZM9.37012 2.66504C8.60726 2.66504 7.92938 3.13589 7.6582 3.83789L7.60938 3.98145L7.50586 4.33496H12.4941L12.3906 3.98145C12.1607 3.20084 11.4437 2.66504 10.6299 2.66504H9.37012Z" />
    </svg>
  );
}
