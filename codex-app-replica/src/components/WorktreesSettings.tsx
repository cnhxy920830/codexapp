import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import {
  DEFAULT_WORKTREES_SETTINGS,
  readWorktreesSettingsSnapshot,
  setWorktreesAutoCleanupEnabled,
  setWorktreesKeepCount,
} from "../services/worktrees";
import { ToggleSwitch } from "./ToggleSwitch";

export function WorktreesSettings() {
  const { t } = useI18n();
  const [state, setState] = useState(DEFAULT_WORKTREES_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisableConfirmOpen, setIsDisableConfirmOpen] = useState(false);
  const [keepCountDraft, setKeepCountDraft] = useState(String(DEFAULT_WORKTREES_SETTINGS.keepCount));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const snapshot = await readWorktreesSettingsSnapshot();
        if (cancelled) {
          return;
        }
        setState(snapshot);
        setKeepCountDraft(String(snapshot.keepCount));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setKeepCountDraft(String(state.keepCount));
  }, [state.keepCount]);

  const persistAutoCleanupEnabled = async (value: boolean) => {
    setIsSaving(true);
    try {
      await setWorktreesAutoCleanupEnabled(value);
      setState((current) => ({ ...current, autoCleanupEnabled: value }));
    } finally {
      setIsSaving(false);
    }
  };

  const persistKeepCount = async (value: number) => {
    setIsSaving(true);
    try {
      await setWorktreesKeepCount(value);
      setState((current) => ({ ...current, keepCount: value }));
      setKeepCountDraft(String(value));
    } finally {
      setIsSaving(false);
    }
  };

  const commitKeepCount = () => {
    if (!state.autoCleanupEnabled || isLoading || isSaving) {
      setKeepCountDraft(String(state.keepCount));
      return;
    }

    const parsed = Number.parseInt(keepCountDraft.trim(), 10);
    if (!Number.isFinite(parsed)) {
      setKeepCountDraft(String(state.keepCount));
      return;
    }

    const nextValue = Math.max(1, Math.trunc(parsed));
    if (nextValue === state.keepCount) {
      setKeepCountDraft(String(nextValue));
      return;
    }

    void persistKeepCount(nextValue).catch(() => {
      setKeepCountDraft(String(state.keepCount));
    });
  };

  const handleAutoCleanupChange = (checked: boolean) => {
    if (checked === state.autoCleanupEnabled || isLoading || isSaving) {
      return;
    }
    if (!checked) {
      setIsDisableConfirmOpen(true);
      return;
    }
    void persistAutoCleanupEnabled(true);
  };

  const confirmDisableAutoCleanup = () => {
    setIsDisableConfirmOpen(false);
    void persistAutoCleanupEnabled(false);
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.section.worktrees")}</div>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow
            label={t("settings.worktrees.autoCleanup.label")}
            description={t("settings.worktrees.autoCleanup.description")}
          >
            <ToggleSwitch
              checked={state.autoCleanupEnabled}
              disabled={isLoading || isSaving}
              ariaLabel={t("settings.worktrees.autoCleanup.ariaLabel")}
              onChange={handleAutoCleanupChange}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.worktrees.keepCount.label")}
            description={
              state.autoCleanupEnabled
                ? t("settings.worktrees.keepCount.description")
                : t("settings.worktrees.keepCount.description.disabled")
            }
          >
            <input
              aria-label={t("settings.worktrees.keepCount.ariaLabel")}
              type="number"
              min={1}
              step={1}
              disabled={!state.autoCleanupEnabled || isLoading || isSaving}
              value={keepCountDraft}
              onChange={(event) => setKeepCountDraft(event.target.value)}
              onBlur={commitKeepCount}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitKeepCount();
                }
              }}
              className="app-control h-9 w-24 rounded-[10px] px-2.5 py-0 text-right text-[13px]"
            />
          </SettingRow>
        </div>
      </div>

      {isDisableConfirmOpen ? (
        <DisableAutoCleanupDialog
          cancelLabel={t("settings.worktrees.autoCleanup.confirm.cancel")}
          body={t("settings.worktrees.autoCleanup.confirm.body")}
          confirmLabel={t("settings.worktrees.autoCleanup.confirm.confirm")}
          title={t("settings.worktrees.autoCleanup.confirm.title")}
          onCancel={() => setIsDisableConfirmOpen(false)}
          onConfirm={confirmDisableAutoCleanup}
        />
      ) : null}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 flex-1">
        <div>{label}</div>
        {description ? <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div> : null}
      </div>
      {children}
    </div>
  );
}

function DisableAutoCleanupDialog({
  body,
  cancelLabel,
  confirmLabel,
  title,
  onCancel,
  onConfirm,
}: {
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="app-title text-[15px] font-medium">{title}</div>
        <div className="app-text-muted mt-2 text-[13px] leading-6">{body}</div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
