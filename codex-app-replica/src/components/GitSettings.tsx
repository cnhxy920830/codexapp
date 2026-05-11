import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import {
  DEFAULT_GIT_SETTINGS,
  readGitSettingsSnapshot,
  setGitAlwaysForcePush,
  setGitBranchPrefix,
  setGitCommitInstructions,
  setGitCreateDraftPullRequest,
  setGitPullRequestInstructions,
  setGitPullRequestMergeMethod,
  setGitShowSidebarPrIcons,
  type GitMergeMethod,
} from "../services/gitSettings";
import {
  DEFAULT_WORKTREES_SETTINGS,
  readWorktreesSettingsSnapshot,
  setWorktreesAutoCleanupEnabled,
  setWorktreesKeepCount,
} from "../services/worktrees";
import type { AppToast } from "./AppToastRegion";
import { ToggleSwitch } from "./ToggleSwitch";

type SaveState = {
  branchPrefix: boolean;
  alwaysForcePush: boolean;
  createDraftPullRequest: boolean;
  pullRequestMergeMethod: boolean;
  showSidebarPrIcons: boolean;
  commitInstructions: boolean;
  pullRequestInstructions: boolean;
  worktreeAutoCleanup: boolean;
  worktreeKeepCount: boolean;
};

const DEFAULT_SAVE_STATE: SaveState = {
  branchPrefix: false,
  alwaysForcePush: false,
  createDraftPullRequest: false,
  pullRequestMergeMethod: false,
  showSidebarPrIcons: false,
  commitInstructions: false,
  pullRequestInstructions: false,
  worktreeAutoCleanup: false,
  worktreeKeepCount: false,
};

export function GitSettings({
  onShowToast,
}: {
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [gitState, setGitState] = useState(DEFAULT_GIT_SETTINGS);
  const [worktreeState, setWorktreeState] = useState(DEFAULT_WORKTREES_SETTINGS);
  const [isGitLoading, setIsGitLoading] = useState(true);
  const [isWorktreeLoading, setIsWorktreeLoading] = useState(true);
  const [saving, setSaving] = useState(DEFAULT_SAVE_STATE);
  const [branchPrefixDraft, setBranchPrefixDraft] = useState<string | null>(null);
  const [commitInstructionsDraft, setCommitInstructionsDraft] = useState<string | null>(null);
  const [pullRequestInstructionsDraft, setPullRequestInstructionsDraft] = useState<string | null>(null);
  const [keepCountDraft, setKeepCountDraft] = useState<string | null>(null);
  const [isDisableAutoCleanupConfirmOpen, setIsDisableAutoCleanupConfirmOpen] = useState(false);
  // Upstream gates these rows through Statsig ids 2764989143 and 2553306736.
  // Keep them hidden until the replica has a faithful gate source.
  const shouldRenderGateConditionedPullRequestSettings = false;

  useEffect(() => {
    let cancelled = false;

    const loadGitSettings = async () => {
      try {
        const snapshot = await readGitSettingsSnapshot();
        if (!cancelled) {
          setGitState(snapshot);
          setBranchPrefixDraft(null);
          setCommitInstructionsDraft(null);
          setPullRequestInstructionsDraft(null);
        }
      } finally {
        if (!cancelled) {
          setIsGitLoading(false);
        }
      }
    };

    const loadWorktreeSettings = async () => {
      try {
        const snapshot = await readWorktreesSettingsSnapshot();
        if (!cancelled) {
          setWorktreeState(snapshot);
          setKeepCountDraft(null);
        }
      } finally {
        if (!cancelled) {
          setIsWorktreeLoading(false);
        }
      }
    };

    void Promise.all([loadGitSettings(), loadWorktreeSettings()]);

    return () => {
      cancelled = true;
    };
  }, []);

  const setSavingFlag = (key: keyof SaveState, value: boolean) => {
    setSaving((current) => ({ ...current, [key]: value }));
  };

  const showToast = (tone: AppToast["tone"], messageKey: Parameters<typeof t>[0]) => {
    onShowToast?.({
      tone,
      message: t(messageKey),
    });
  };

  const branchPrefixValue = branchPrefixDraft ?? gitState.branchPrefix;
  const isBranchPrefixDirty =
    branchPrefixDraft !== null && branchPrefixDraft !== gitState.branchPrefix;
  const isBranchPrefixDisabled = isGitLoading || saving.branchPrefix;

  const commitInstructionsValue = commitInstructionsDraft ?? gitState.commitInstructions;
  const isCommitInstructionsDirty =
    commitInstructionsDraft !== null && commitInstructionsDraft !== gitState.commitInstructions;
  const isCommitInstructionsDisabled = isGitLoading || saving.commitInstructions;

  const pullRequestInstructionsValue =
    pullRequestInstructionsDraft ?? gitState.pullRequestInstructions;
  const isPullRequestInstructionsDirty =
    pullRequestInstructionsDraft !== null &&
    pullRequestInstructionsDraft !== gitState.pullRequestInstructions;
  const isPullRequestInstructionsDisabled = isGitLoading || saving.pullRequestInstructions;

  const keepCountValue = keepCountDraft ?? String(worktreeState.keepCount);
  const isWorktreeAutoCleanupDisabled = isWorktreeLoading || saving.worktreeAutoCleanup;
  const isKeepCountDisabled =
    isWorktreeLoading ||
    saving.worktreeKeepCount ||
    isWorktreeAutoCleanupDisabled ||
    !worktreeState.autoCleanupEnabled;

  const saveBranchPrefixIfDirty = async () => {
    if (!isBranchPrefixDirty || isBranchPrefixDisabled) {
      return;
    }

    setSavingFlag("branchPrefix", true);
    try {
      await setGitBranchPrefix(branchPrefixValue);
      setGitState((current) => ({ ...current, branchPrefix: branchPrefixValue }));
      setBranchPrefixDraft(null);
      showToast("success", "settings.git.branchPrefix.save.success");
    } catch {
      showToast("error", "settings.git.branchPrefix.save.error");
    } finally {
      setSavingFlag("branchPrefix", false);
    }
  };

  const saveAlwaysForcePush = async (value: boolean) => {
    if (isGitLoading || saving.alwaysForcePush) {
      return;
    }

    setSavingFlag("alwaysForcePush", true);
    try {
      await setGitAlwaysForcePush(value);
      setGitState((current) => ({ ...current, alwaysForcePush: value }));
      showToast(
        "success",
        value
          ? "settings.git.forcePush.save.enabled"
          : "settings.git.forcePush.save.disabled",
      );
    } catch {
      showToast("error", "settings.git.forcePush.save.error");
    } finally {
      setSavingFlag("alwaysForcePush", false);
    }
  };

  const saveCreateDraftPullRequest = async (value: boolean) => {
    if (isGitLoading || saving.createDraftPullRequest) {
      return;
    }

    setSavingFlag("createDraftPullRequest", true);
    try {
      await setGitCreateDraftPullRequest(value);
      setGitState((current) => ({ ...current, createDraftPullRequest: value }));
      showToast(
        "success",
        value
          ? "settings.git.createDraftPullRequest.save.enabled"
          : "settings.git.createDraftPullRequest.save.disabled",
      );
    } catch {
      showToast("error", "settings.git.createDraftPullRequest.save.error");
    } finally {
      setSavingFlag("createDraftPullRequest", false);
    }
  };

  const savePullRequestMergeMethod = async (value: GitMergeMethod) => {
    if (isGitLoading || saving.pullRequestMergeMethod || value === gitState.pullRequestMergeMethod) {
      return;
    }

    setSavingFlag("pullRequestMergeMethod", true);
    try {
      await setGitPullRequestMergeMethod(value);
      setGitState((current) => ({ ...current, pullRequestMergeMethod: value }));
      showToast("success", "settings.git.pullRequestMergeMethod.save.success");
    } catch {
      showToast("error", "settings.git.pullRequestMergeMethod.save.error");
    } finally {
      setSavingFlag("pullRequestMergeMethod", false);
    }
  };

  const saveShowSidebarPrIcons = async (value: boolean) => {
    if (isGitLoading || saving.showSidebarPrIcons) {
      return;
    }

    setSavingFlag("showSidebarPrIcons", true);
    try {
      await setGitShowSidebarPrIcons(value);
      setGitState((current) => ({ ...current, showSidebarPrIcons: value }));
      showToast(
        "success",
        value
          ? "settings.git.showSidebarPrIcons.save.enabled"
          : "settings.git.showSidebarPrIcons.save.disabled",
      );
    } catch {
      showToast("error", "settings.git.showSidebarPrIcons.save.error");
    } finally {
      setSavingFlag("showSidebarPrIcons", false);
    }
  };

  const saveCommitInstructionsIfDirty = async () => {
    if (!isCommitInstructionsDirty || isCommitInstructionsDisabled) {
      return;
    }

    setSavingFlag("commitInstructions", true);
    try {
      await setGitCommitInstructions(commitInstructionsValue);
      setGitState((current) => ({
        ...current,
        commitInstructions: commitInstructionsValue,
      }));
      setCommitInstructionsDraft(null);
      showToast("success", "settings.git.commitInstructions.save.success");
    } catch {
      showToast("error", "settings.git.commitInstructions.save.error");
    } finally {
      setSavingFlag("commitInstructions", false);
    }
  };

  const savePullRequestInstructionsIfDirty = async () => {
    if (!isPullRequestInstructionsDirty || isPullRequestInstructionsDisabled) {
      return;
    }

    setSavingFlag("pullRequestInstructions", true);
    try {
      await setGitPullRequestInstructions(pullRequestInstructionsValue);
      setGitState((current) => ({
        ...current,
        pullRequestInstructions: pullRequestInstructionsValue,
      }));
      setPullRequestInstructionsDraft(null);
      showToast("success", "settings.git.prInstructions.save.success");
    } catch {
      showToast("error", "settings.git.prInstructions.save.error");
    } finally {
      setSavingFlag("pullRequestInstructions", false);
    }
  };

  const saveWorktreeAutoCleanup = async (value: boolean) => {
    if (isWorktreeLoading || saving.worktreeAutoCleanup) {
      return;
    }

    setSavingFlag("worktreeAutoCleanup", true);
    try {
      await setWorktreesAutoCleanupEnabled(value);
      setWorktreeState((current) => ({ ...current, autoCleanupEnabled: value }));
      showToast(
        "success",
        value
          ? "settings.worktrees.autoCleanup.save.enabled"
          : "settings.worktrees.autoCleanup.save.disabled",
      );
    } catch {
      showToast("error", "settings.worktrees.autoCleanup.save.error");
    } finally {
      setSavingFlag("worktreeAutoCleanup", false);
    }
  };

  const saveWorktreeKeepCountIfDirty = async () => {
    if (isKeepCountDisabled || keepCountDraft === null) {
      return;
    }

    const trimmed = keepCountDraft.trim();
    const parsed = Number.parseInt(trimmed, 10);

    if (trimmed.length === 0 || Number.isNaN(parsed)) {
      setKeepCountDraft(null);
      return;
    }

    const nextValue = Math.max(1, Math.trunc(parsed));
    if (nextValue === worktreeState.keepCount) {
      setKeepCountDraft(null);
      return;
    }

    setSavingFlag("worktreeKeepCount", true);
    try {
      await setWorktreesKeepCount(nextValue);
      setWorktreeState((current) => ({ ...current, keepCount: nextValue }));
      setKeepCountDraft(null);
      showToast("success", "settings.worktrees.keepCount.save.success");
    } catch {
      showToast("error", "settings.worktrees.keepCount.save.error");
    } finally {
      setSavingFlag("worktreeKeepCount", false);
    }
  };

  useEffect(() => {
    const canSaveWithHotkey =
      (isBranchPrefixDirty && !isBranchPrefixDisabled) ||
      (isCommitInstructionsDirty && !isCommitInstructionsDisabled) ||
      (isPullRequestInstructionsDirty && !isPullRequestInstructionsDisabled);

    if (!canSaveWithHotkey) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();
      void Promise.allSettled([
        saveBranchPrefixIfDirty(),
        saveCommitInstructionsIfDirty(),
        savePullRequestInstructionsIfDirty(),
      ]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isBranchPrefixDirty,
    isBranchPrefixDisabled,
    isCommitInstructionsDirty,
    isCommitInstructionsDisabled,
    isPullRequestInstructionsDirty,
    isPullRequestInstructionsDisabled,
    branchPrefixValue,
    commitInstructionsValue,
    pullRequestInstructionsValue,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[672px] flex-col gap-4 px-5 py-5">
      <div className="pb-1">
        <h1 className="text-[20px] font-medium leading-7">
          {t("settings.section.git-settings")}
        </h1>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow
            label={t("settings.git.branchPrefix.label")}
            description={t("settings.git.branchPrefix.description")}
          >
            <input
              aria-label={t("settings.git.branchPrefix.ariaLabel")}
              value={branchPrefixValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setBranchPrefixDraft(
                  nextValue === gitState.branchPrefix ? null : nextValue,
                );
              }}
              onBlur={() => {
                void saveBranchPrefixIfDirty();
              }}
              placeholder={t("settings.git.branchPrefix.placeholder")}
              disabled={isBranchPrefixDisabled}
              className="app-control h-9 w-56 rounded-[10px] px-3 text-[13px]"
            />
          </SettingRow>

          <SettingRow
            label={t("settings.git.forcePush.label")}
            description={t("settings.git.forcePush.description")}
          >
            <ToggleSwitch
              checked={gitState.alwaysForcePush}
              disabled={isGitLoading || saving.alwaysForcePush}
              ariaLabel={t("settings.git.forcePush.ariaLabel")}
              onChange={(checked) => {
                void saveAlwaysForcePush(checked);
              }}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.git.createDraftPullRequest.label")}
            description={t("settings.git.createDraftPullRequest.description")}
          >
            <ToggleSwitch
              checked={gitState.createDraftPullRequest}
              disabled={isGitLoading || saving.createDraftPullRequest}
              ariaLabel={t("settings.git.createDraftPullRequest.ariaLabel")}
              onChange={(checked) => {
                void saveCreateDraftPullRequest(checked);
              }}
            />
          </SettingRow>

          {shouldRenderGateConditionedPullRequestSettings ? (
            <>
              <SettingRow
                label={t("settings.git.pullRequestMergeMethod.label")}
                description={t("settings.git.pullRequestMergeMethod.description")}
              >
                <select
                  aria-label={t("settings.git.pullRequestMergeMethod.ariaLabel")}
                  value={gitState.pullRequestMergeMethod}
                  disabled={isGitLoading || saving.pullRequestMergeMethod}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "merge" || next === "squash") {
                      void savePullRequestMergeMethod(next);
                    }
                  }}
                  className="app-control h-9 rounded-[10px] px-3 text-[13px]"
                >
                  <option value="merge">{t("settings.git.pullRequestMergeMethod.merge")}</option>
                  <option value="squash">{t("settings.git.pullRequestMergeMethod.squash")}</option>
                </select>
              </SettingRow>

              <SettingRow
                label={t("settings.git.showSidebarPrIcons.label")}
                description={t("settings.git.showSidebarPrIcons.description")}
              >
                <ToggleSwitch
                  checked={gitState.showSidebarPrIcons}
                  disabled={isGitLoading || saving.showSidebarPrIcons}
                  ariaLabel={t("settings.git.showSidebarPrIcons.ariaLabel")}
                  onChange={(checked) => {
                    void saveShowSidebarPrIcons(checked);
                  }}
                />
              </SettingRow>
            </>
          ) : null}

          <SettingRow
            label={t("settings.worktrees.autoCleanup.label")}
            description={t("settings.worktrees.autoCleanup.description")}
          >
            <ToggleSwitch
              checked={worktreeState.autoCleanupEnabled}
              disabled={isWorktreeAutoCleanupDisabled}
              ariaLabel={t("settings.worktrees.autoCleanup.ariaLabel")}
              onChange={(checked) => {
                if (
                  checked === worktreeState.autoCleanupEnabled ||
                  isWorktreeAutoCleanupDisabled
                ) {
                  return;
                }

                if (checked) {
                  void saveWorktreeAutoCleanup(true);
                  return;
                }

                setIsDisableAutoCleanupConfirmOpen(true);
              }}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.worktrees.keepCount.label")}
            description={
              worktreeState.autoCleanupEnabled
                ? t("settings.worktrees.keepCount.description")
                : t("settings.worktrees.keepCount.description.disabled")
            }
          >
            <input
              aria-label={t("settings.worktrees.keepCount.ariaLabel")}
              type="number"
              min={1}
              step={1}
              disabled={isKeepCountDisabled}
              value={keepCountValue}
              onChange={(event) => {
                if (isKeepCountDisabled) {
                  return;
                }

                const nextValue = event.target.value;
                setKeepCountDraft(
                  nextValue === String(worktreeState.keepCount) ? null : nextValue,
                );
              }}
              onBlur={() => {
                void saveWorktreeKeepCountIfDirty();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveWorktreeKeepCountIfDirty();
                }
              }}
              className="app-control h-9 w-24 rounded-[10px] px-2.5 py-0 text-right text-[13px]"
            />
          </SettingRow>
        </div>
      </div>

      <InstructionsCard
        title={t("settings.git.commitInstructions.label")}
        description={t("settings.git.commitInstructions.description")}
        placeholder={t("settings.git.commitInstructions.placeholder")}
        saveLabel={t("settings.git.commitInstructions.save")}
        ariaLabel={t("settings.git.commitInstructions.ariaLabel")}
        disabled={isCommitInstructionsDisabled}
        draft={commitInstructionsValue}
        isDirty={isCommitInstructionsDirty}
        onDraftChange={(value) => {
          setCommitInstructionsDraft(
            value === gitState.commitInstructions ? null : value,
          );
        }}
        onSave={() => {
          void saveCommitInstructionsIfDirty();
        }}
      />

      <InstructionsCard
        title={t("settings.git.prInstructions.label")}
        description={t("settings.git.prInstructions.description")}
        placeholder={t("settings.git.prInstructions.placeholder")}
        saveLabel={t("settings.git.prInstructions.save")}
        ariaLabel={t("settings.git.prInstructions.ariaLabel")}
        disabled={isPullRequestInstructionsDisabled}
        draft={pullRequestInstructionsValue}
        isDirty={isPullRequestInstructionsDirty}
        onDraftChange={(value) => {
          setPullRequestInstructionsDraft(
            value === gitState.pullRequestInstructions ? null : value,
          );
        }}
        onSave={() => {
          void savePullRequestInstructionsIfDirty();
        }}
      />

      {isDisableAutoCleanupConfirmOpen ? (
        <DisableAutoCleanupDialog
          cancelLabel={t("settings.worktrees.autoCleanup.confirm.cancel")}
          body={t("settings.worktrees.autoCleanup.confirm.body")}
          confirmLabel={t("settings.worktrees.autoCleanup.confirm.confirm")}
          title={t("settings.worktrees.autoCleanup.confirm.title")}
          onCancel={() => setIsDisableAutoCleanupConfirmOpen(false)}
          onConfirm={() => {
            setKeepCountDraft(null);
            setIsDisableAutoCleanupConfirmOpen(false);
            void saveWorktreeAutoCleanup(false);
          }}
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
        {description ? (
          <div className="app-text-muted mt-1 text-[12px] leading-5">
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function InstructionsCard({
  ariaLabel,
  description,
  disabled,
  draft,
  isDirty,
  onDraftChange,
  onSave,
  placeholder,
  saveLabel,
  title,
}: {
  ariaLabel: string;
  description: string;
  disabled: boolean;
  draft: string;
  isDirty: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  placeholder: string;
  saveLabel: string;
  title: string;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[14px] leading-6">{title}</div>
        <button
          type="button"
          disabled={disabled || !isDirty}
          onClick={onSave}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
      <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
      <textarea
        aria-label={ariaLabel}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        className="app-control mt-4 w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
      />
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
