import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
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
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";

type SaveState = {
  alwaysForcePush: boolean;
  branchPrefix: boolean;
  commitInstructions: boolean;
  createDraftPullRequest: boolean;
  pullRequestInstructions: boolean;
  pullRequestMergeMethod: boolean;
  showSidebarPrIcons: boolean;
  worktreeAutoCleanup: boolean;
  worktreeKeepCount: boolean;
};

const DEFAULT_SAVE_STATE: SaveState = {
  alwaysForcePush: false,
  branchPrefix: false,
  commitInstructions: false,
  createDraftPullRequest: false,
  pullRequestInstructions: false,
  pullRequestMergeMethod: false,
  showSidebarPrIcons: false,
  worktreeAutoCleanup: false,
  worktreeKeepCount: false,
};

export function GitSettings({
  onShowToast,
}: {
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const showPullRequestMergeMethod = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.gitPullRequestMergeMethod,
  );
  const hideSidebarPrIconsSetting = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.gitHideSidebarPrIcons,
  );
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

  const showToast = (
    tone: AppToast["tone"],
    messageKey: Parameters<typeof t>[0],
  ) => {
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
    commitInstructionsDraft !== null &&
    commitInstructionsDraft !== gitState.commitInstructions;
  const isCommitInstructionsDisabled = isGitLoading || saving.commitInstructions;

  const pullRequestInstructionsValue =
    pullRequestInstructionsDraft ?? gitState.pullRequestInstructions;
  const isPullRequestInstructionsDirty =
    pullRequestInstructionsDraft !== null &&
    pullRequestInstructionsDraft !== gitState.pullRequestInstructions;
  const isPullRequestInstructionsDisabled =
    isGitLoading || saving.pullRequestInstructions;

  const keepCountValue = keepCountDraft ?? String(worktreeState.keepCount);
  const isWorktreeAutoCleanupDisabled =
    isWorktreeLoading || saving.worktreeAutoCleanup;
  const isKeepCountDisabled =
    isWorktreeLoading ||
    saving.worktreeKeepCount ||
    isWorktreeAutoCleanupDisabled ||
    !worktreeState.autoCleanupEnabled;

  const saveBranchPrefixIfDirty = useEffectEvent(async () => {
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
  });

  const saveAlwaysForcePush = useEffectEvent(async (value: boolean) => {
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
  });

  const savePullRequestMergeMethod = useEffectEvent(
    async (value: GitMergeMethod) => {
      if (
        isGitLoading ||
        saving.pullRequestMergeMethod ||
        value === gitState.pullRequestMergeMethod
      ) {
        return;
      }

      setSavingFlag("pullRequestMergeMethod", true);
      try {
        await setGitPullRequestMergeMethod(value);
        setGitState((current) => ({
          ...current,
          pullRequestMergeMethod: value,
        }));
        showToast("success", "settings.git.pullRequestMergeMethod.save.success");
      } catch {
        showToast("error", "settings.git.pullRequestMergeMethod.save.error");
      } finally {
        setSavingFlag("pullRequestMergeMethod", false);
      }
    },
  );

  const saveCreateDraftPullRequest = useEffectEvent(async (value: boolean) => {
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
  });

  const saveShowSidebarPrIcons = useEffectEvent(async (value: boolean) => {
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
  });

  const saveCommitInstructionsIfDirty = useEffectEvent(async () => {
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
  });

  const savePullRequestInstructionsIfDirty = useEffectEvent(async () => {
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
  });

  const saveWorktreeAutoCleanup = useEffectEvent(async (value: boolean) => {
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
  });

  const handleWorktreeAutoCleanupToggle = useEffectEvent((value: boolean) => {
    if (isWorktreeAutoCleanupDisabled) {
      return;
    }

    if (value) {
      void saveWorktreeAutoCleanup(true);
      return;
    }

    setIsDisableAutoCleanupConfirmOpen(true);
  });

  const confirmDisableWorktreeAutoCleanup = useEffectEvent(() => {
    setKeepCountDraft(null);
    setIsDisableAutoCleanupConfirmOpen(false);
    void saveWorktreeAutoCleanup(false);
  });

  const saveWorktreeKeepCountIfDirty = useEffectEvent(async () => {
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
  });

  const saveWithHotkey = useEffectEvent((event: KeyboardEvent) => {
    event.preventDefault();
    void Promise.allSettled([
      saveBranchPrefixIfDirty(),
      saveCommitInstructionsIfDirty(),
      savePullRequestInstructionsIfDirty(),
    ]);
  });

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

      saveWithHotkey(event);
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
    saveWithHotkey,
  ]);

  return (
    <SettingsContentLayout title={<SettingsSectionTitle slug="git-settings" />}>
      <SettingsGroup>
        <SettingsGroup.Content>
          <SettingsSurface>
            <SettingsRow
              label={t("settings.git.branchPrefix.label")}
              description={t("settings.git.branchPrefix.description")}
              control={
                <input
                  aria-label={t("settings.git.branchPrefix.ariaLabel")}
                  value={branchPrefixValue}
                  onChange={(event) => {
                    if (isBranchPrefixDisabled) {
                      return;
                    }

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
                  className="w-56 rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-base text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border"
                />
              }
            />

            {showPullRequestMergeMethod ? (
              <SettingsRow
                label={t("settings.git.pullRequestMergeMethod.label")}
                description={t("settings.git.pullRequestMergeMethod.description")}
                control={
                  <SegmentedControl
                    ariaLabel={t("settings.git.pullRequestMergeMethod.ariaLabel")}
                    selectedId={gitState.pullRequestMergeMethod}
                    onSelect={(value) => {
                      if (value === "merge" || value === "squash") {
                        void savePullRequestMergeMethod(value);
                      }
                    }}
                    options={[
                      {
                        id: "merge",
                        label: t("settings.git.pullRequestMergeMethod.merge"),
                        ariaLabel: t("settings.git.pullRequestMergeMethod.merge"),
                        disabled: isGitLoading || saving.pullRequestMergeMethod,
                      },
                      {
                        id: "squash",
                        label: t("settings.git.pullRequestMergeMethod.squash"),
                        ariaLabel: t("settings.git.pullRequestMergeMethod.squash"),
                        disabled: isGitLoading || saving.pullRequestMergeMethod,
                      },
                    ]}
                  />
                }
              />
            ) : null}

            {showPullRequestMergeMethod && !hideSidebarPrIconsSetting ? (
              <SettingsRow
                label={t("settings.git.showSidebarPrIcons.label")}
                description={t("settings.git.showSidebarPrIcons.description")}
                control={
                  <ToggleSwitch
                    checked={gitState.showSidebarPrIcons}
                    disabled={isGitLoading || saving.showSidebarPrIcons}
                    ariaLabel={t("settings.git.showSidebarPrIcons.ariaLabel")}
                    onChange={(checked) => {
                      void saveShowSidebarPrIcons(checked);
                    }}
                  />
                }
              />
            ) : null}

            <SettingsRow
              label={t("settings.git.forcePush.label")}
              description={t("settings.git.forcePush.description")}
              control={
                <ToggleSwitch
                  checked={gitState.alwaysForcePush}
                  disabled={isGitLoading || saving.alwaysForcePush}
                  ariaLabel={t("settings.git.forcePush.ariaLabel")}
                  onChange={(checked) => {
                    void saveAlwaysForcePush(checked);
                  }}
                />
              }
            />

            <SettingsRow
              label={t("settings.git.createDraftPullRequest.label")}
              description={t("settings.git.createDraftPullRequest.description")}
              control={
                <ToggleSwitch
                  checked={gitState.createDraftPullRequest}
                  disabled={isGitLoading || saving.createDraftPullRequest}
                  ariaLabel={t("settings.git.createDraftPullRequest.ariaLabel")}
                  onChange={(checked) => {
                    void saveCreateDraftPullRequest(checked);
                  }}
                />
              }
            />

            <div className="electron:block hidden">
              <SettingsRow
                label={t("settings.worktrees.autoCleanup.label")}
                description={t("settings.worktrees.autoCleanup.description")}
                control={
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

                      handleWorktreeAutoCleanupToggle(checked);
                    }}
                  />
                }
              />

              <SettingsRow
                label={t("settings.worktrees.keepCount.label")}
                description={
                  worktreeState.autoCleanupEnabled
                    ? t("settings.worktrees.keepCount.description")
                    : t("settings.worktrees.keepCount.description.disabled")
                }
                control={
                  <div className="ml-6">
                    <input
                      aria-label={t("settings.worktrees.keepCount.ariaLabel")}
                      className="w-24 rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-base text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border"
                      value={keepCountValue}
                      onChange={(event) => {
                        if (isKeepCountDisabled) {
                          return;
                        }

                        const nextValue = event.target.value;
                        setKeepCountDraft(
                          nextValue === String(worktreeState.keepCount)
                            ? null
                            : nextValue,
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
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      disabled={isKeepCountDisabled}
                    />
                  </div>
                }
              />
            </div>
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Header
          title={t("settings.git.commitInstructions.label")}
          subtitle={t("settings.git.commitInstructions.description")}
          actions={
            <Button
              color="secondary"
              disabled={!isCommitInstructionsDirty || isCommitInstructionsDisabled}
              loading={saving.commitInstructions}
              onClick={() => {
                void saveCommitInstructionsIfDirty();
              }}
              size="toolbar"
            >
              {t("settings.git.commitInstructions.save")}
            </Button>
          }
        />
        <SettingsGroup.Content>
          <textarea
            aria-label={t("settings.git.commitInstructions.ariaLabel")}
            value={commitInstructionsValue}
            onChange={(event) => {
              if (isCommitInstructionsDisabled) {
                return;
              }

              const nextValue = event.target.value;
              setCommitInstructionsDraft(
                nextValue === gitState.commitInstructions ? null : nextValue,
              );
            }}
            placeholder={t("settings.git.commitInstructions.placeholder")}
            disabled={isCommitInstructionsDisabled}
            rows={6}
            className="mt-1.5 w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-2 text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border"
          />
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Header
          title={t("settings.git.prInstructions.label")}
          subtitle={t("settings.git.prInstructions.description")}
          actions={
            <Button
              color="secondary"
              disabled={
                !isPullRequestInstructionsDirty ||
                isPullRequestInstructionsDisabled
              }
              loading={saving.pullRequestInstructions}
              onClick={() => {
                void savePullRequestInstructionsIfDirty();
              }}
              size="toolbar"
            >
              {t("settings.git.prInstructions.save")}
            </Button>
          }
        />
        <SettingsGroup.Content>
          <textarea
            aria-label={t("settings.git.prInstructions.ariaLabel")}
            value={pullRequestInstructionsValue}
            onChange={(event) => {
              if (isPullRequestInstructionsDisabled) {
                return;
              }

              const nextValue = event.target.value;
              setPullRequestInstructionsDraft(
                nextValue === gitState.pullRequestInstructions ? null : nextValue,
              );
            }}
            placeholder={t("settings.git.prInstructions.placeholder")}
            disabled={isPullRequestInstructionsDisabled}
            rows={6}
            className="mt-1.5 w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-2 text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border"
          />
        </SettingsGroup.Content>
      </SettingsGroup>

      {isDisableAutoCleanupConfirmOpen ? (
        <DisableAutoCleanupDialog
          open={isDisableAutoCleanupConfirmOpen}
          onOpenChange={setIsDisableAutoCleanupConfirmOpen}
          onConfirm={confirmDisableWorktreeAutoCleanup}
        />
      ) : null}
    </SettingsContentLayout>
  );
}

function SettingsRow({
  className,
  control,
  description,
  label,
}: {
  className?: string;
  control: ReactNode;
  description?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className={joinClasses("flex items-center justify-between gap-4 p-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="min-w-0 text-sm text-token-text-primary">{label}</div>
          {description ? (
            <div className="text-token-text-secondary min-w-0 text-sm">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

function SegmentedControl({
  ariaLabel,
  onSelect,
  options,
  selectedId,
}: {
  ariaLabel: string;
  onSelect: (id: string) => void;
  options: Array<{
    ariaLabel: string;
    disabled?: boolean;
    id: string;
    label: ReactNode;
  }>;
  selectedId: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        const disabled = option.disabled ?? false;

        return (
          <Button
            key={option.id}
            color={selected ? "secondary" : "ghost"}
            size="default"
            aria-pressed={selected}
            aria-label={option.ariaLabel}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onSelect(option.id);
              }
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function DisableAutoCleanupDialog({
  open,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <DialogOverlay onDismiss={() => onOpenChange(false)}>
      <div
        aria-modal="true"
        role="dialog"
        aria-label={t("settings.worktrees.autoCleanup.confirm.title")}
        className="w-full max-w-[460px] rounded-[18px] border border-token-border bg-token-main-surface-primary px-5 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-[18px] font-medium text-token-text-primary">
              {t("settings.worktrees.autoCleanup.confirm.title")}
            </div>
          </div>

          <div className="text-token-description-foreground">
            <p>{t("settings.worktrees.autoCleanup.confirm.body")}</p>
          </div>

          <div>
            <div className="flex items-center justify-end gap-2">
              <Button color="ghost" onClick={() => onOpenChange(false)}>
                {t("settings.worktrees.autoCleanup.confirm.cancel")}
              </Button>
              <Button color="danger" onClick={onConfirm}>
                {t("settings.worktrees.autoCleanup.confirm.confirm")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}

function DialogOverlay({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={onDismiss}
    >
      {children}
    </div>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
