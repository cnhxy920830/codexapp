import type { ReactNode } from "react";
import { useI18n } from "../i18n/i18n";

export type AppToast = {
  description?: ReactNode;
  message: ReactNode;
  tone: "success" | "error" | "info";
};

export function AppToastRegion({
  toast,
  onDismiss,
}: {
  toast: AppToast | null;
  onDismiss: () => void;
}) {
  const { t } = useI18n();

  if (toast === null) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-40 flex max-w-[360px]">
      <div
        role="alert"
        className={[
          toast.tone === "error" ? "app-card-error" : "app-card",
          "pointer-events-auto inline-flex items-start gap-2 rounded-[18px] px-3 py-2 text-[13px] shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium">{toast.message}</div>
          {toast.description ? (
            <div className="mt-1 text-[12px] leading-5 opacity-80">{toast.description}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("codex.alert.closeAriaLabel")}
          className="app-control-weak mt-[1px] flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
