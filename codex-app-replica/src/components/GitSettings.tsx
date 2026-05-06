import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import {
  DEFAULT_GIT_SETTINGS,
  readGitSettingsSnapshot,
  setGitAlwaysForcePush,
  setGitBranchPrefix,
  setGitCreateDraftPullRequest,
  setGitCommitInstructions,
  setGitPullRequestMergeMethod,
  setGitPullRequestInstructions,
  setGitShowSidebarPrIcons,
  type GitMergeMethod,
} from "../services/gitSettings";
import { ToggleSwitch } from "./ToggleSwitch";

export function GitSettings() {
  const { t } = useI18n();
  const [state, setState] = useState(DEFAULT_GIT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [branchPrefixDraft, setBranchPrefixDraft] = useState(DEFAULT_GIT_SETTINGS.branchPrefix);
  const [commitInstructionsDraft, setCommitInstructionsDraft] = useState(
    DEFAULT_GIT_SETTINGS.commitInstructions,
  );
  const [pullRequestInstructionsDraft, setPullRequestInstructionsDraft] = useState(
    DEFAULT_GIT_SETTINGS.pullRequestInstructions,
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const snapshot = await readGitSettingsSnapshot();
        if (cancelled) {
          return;
        }
        setState(snapshot);
        setBranchPrefixDraft(snapshot.branchPrefix);
        setCommitInstructionsDraft(snapshot.commitInstructions);
        setPullRequestInstructionsDraft(snapshot.pullRequestInstructions);
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
    setBranchPrefixDraft(state.branchPrefix);
  }, [state.branchPrefix]);

  useEffect(() => {
    setCommitInstructionsDraft(state.commitInstructions);
  }, [state.commitInstructions]);

  useEffect(() => {
    setPullRequestInstructionsDraft(state.pullRequestInstructions);
  }, [state.pullRequestInstructions]);

  const persistBranchPrefix = async (value: string) => {
    setIsSaving(true);
    try {
      await setGitBranchPrefix(value);
      setState((current) => ({ ...current, branchPrefix: value }));
      setBranchPrefixDraft(value);
    } finally {
      setIsSaving(false);
    }
  };

  const persistBooleanSetting = async (key: "alwaysForcePush" | "createDraftPullRequest" | "showSidebarPrIcons", value: boolean) => {
    setIsSaving(true);
    try {
      switch (key) {
        case "alwaysForcePush":
          await setGitAlwaysForcePush(value);
          break;
        case "createDraftPullRequest":
          await setGitCreateDraftPullRequest(value);
          break;
        case "showSidebarPrIcons":
          await setGitShowSidebarPrIcons(value);
          break;
      }
      setState((current) => ({ ...current, [key]: value }));
    } finally {
      setIsSaving(false);
    }
  };

  const persistMergeMethod = async (value: GitMergeMethod) => {
    setIsSaving(true);
    try {
      await setGitPullRequestMergeMethod(value);
      setState((current) => ({ ...current, pullRequestMergeMethod: value }));
    } finally {
      setIsSaving(false);
    }
  };

  const persistCommitInstructions = async (value: string) => {
    setIsSaving(true);
    try {
      await setGitCommitInstructions(value);
      setState((current) => ({ ...current, commitInstructions: value }));
      setCommitInstructionsDraft(value);
    } finally {
      setIsSaving(false);
    }
  };

  const persistPullRequestInstructions = async (value: string) => {
    setIsSaving(true);
    try {
      await setGitPullRequestInstructions(value);
      setState((current) => ({ ...current, pullRequestInstructions: value }));
      setPullRequestInstructionsDraft(value);
    } finally {
      setIsSaving(false);
    }
  };

  const commitBranchPrefix = () => {
    if (isLoading || isSaving) {
      setBranchPrefixDraft(state.branchPrefix);
      return;
    }

    const nextValue = branchPrefixDraft;
    if (nextValue === state.branchPrefix) {
      setBranchPrefixDraft(nextValue);
      return;
    }

    void persistBranchPrefix(nextValue).catch(() => {
      setBranchPrefixDraft(state.branchPrefix);
    });
  };

  const commitCommitInstructions = () => {
    if (isLoading || isSaving) {
      setCommitInstructionsDraft(state.commitInstructions);
      return;
    }
    if (commitInstructionsDraft === state.commitInstructions) {
      return;
    }
    void persistCommitInstructions(commitInstructionsDraft).catch(() => {
      setCommitInstructionsDraft(state.commitInstructions);
    });
  };

  const commitPullRequestInstructions = () => {
    if (isLoading || isSaving) {
      setPullRequestInstructionsDraft(state.pullRequestInstructions);
      return;
    }
    if (pullRequestInstructionsDraft === state.pullRequestInstructions) {
      return;
    }
    void persistPullRequestInstructions(pullRequestInstructionsDraft).catch(() => {
      setPullRequestInstructionsDraft(state.pullRequestInstructions);
    });
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.section.git-settings")}</div>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow label={t("settings.git.branchPrefix.label")} description={t("settings.git.branchPrefix.description")}>
            <input
              aria-label={t("settings.git.branchPrefix.ariaLabel")}
              value={branchPrefixDraft}
              onChange={(event) => setBranchPrefixDraft(event.target.value)}
              onBlur={commitBranchPrefix}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitBranchPrefix();
                }
              }}
              placeholder={t("settings.git.branchPrefix.placeholder")}
              disabled={isLoading || isSaving}
              className="app-control h-9 w-56 rounded-[10px] px-3 text-[13px]"
            />
          </SettingRow>

          <SettingRow label={t("settings.git.forcePush.label")} description={t("settings.git.forcePush.description")}>
            <ToggleSwitch
              checked={state.alwaysForcePush}
              disabled={isLoading || isSaving}
              ariaLabel={t("settings.git.forcePush.ariaLabel")}
              onChange={(checked) => void persistBooleanSetting("alwaysForcePush", checked)}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.git.createDraftPullRequest.label")}
            description={t("settings.git.createDraftPullRequest.description")}
          >
            <ToggleSwitch
              checked={state.createDraftPullRequest}
              disabled={isLoading || isSaving}
              ariaLabel={t("settings.git.createDraftPullRequest.ariaLabel")}
              onChange={(checked) => void persistBooleanSetting("createDraftPullRequest", checked)}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.git.pullRequestMergeMethod.label")}
            description={t("settings.git.pullRequestMergeMethod.description")}
          >
            <SegmentedChoiceControl
              ariaLabel={t("settings.git.pullRequestMergeMethod.ariaLabel")}
              disabled={isLoading || isSaving}
              options={[
                {
                  id: "merge",
                  label: t("settings.git.pullRequestMergeMethod.merge"),
                },
                {
                  id: "squash",
                  label: t("settings.git.pullRequestMergeMethod.squash"),
                },
              ]}
              value={state.pullRequestMergeMethod}
              onChange={(value) => void persistMergeMethod(value)}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.git.showSidebarPrIcons.label")}
            description={t("settings.git.showSidebarPrIcons.description")}
          >
            <ToggleSwitch
              checked={state.showSidebarPrIcons}
              disabled={isLoading || isSaving}
              ariaLabel={t("settings.git.showSidebarPrIcons.ariaLabel")}
              onChange={(checked) => void persistBooleanSetting("showSidebarPrIcons", checked)}
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
        disabled={isLoading || isSaving}
        draft={commitInstructionsDraft}
        isDirty={commitInstructionsDraft !== state.commitInstructions}
        onDraftChange={setCommitInstructionsDraft}
        onSave={() => commitCommitInstructions()}
      />

      <InstructionsCard
        title={t("settings.git.prInstructions.label")}
        description={t("settings.git.prInstructions.description")}
        placeholder={t("settings.git.prInstructions.placeholder")}
        saveLabel={t("settings.git.prInstructions.save")}
        ariaLabel={t("settings.git.prInstructions.ariaLabel")}
        disabled={isLoading || isSaving}
        draft={pullRequestInstructionsDraft}
        isDirty={pullRequestInstructionsDraft !== state.pullRequestInstructions}
        onDraftChange={setPullRequestInstructionsDraft}
        onSave={() => commitPullRequestInstructions()}
      />
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

function SegmentedChoiceControl({
  ariaLabel,
  disabled,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  options: Array<{ id: GitMergeMethod; label: string }>;
  value: GitMergeMethod;
  onChange: (value: GitMergeMethod) => void;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="app-segmented inline-flex rounded-[12px] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={[
            "rounded-[9px] px-3 py-1.5 text-[13px] transition",
            value === option.id ? "app-segmented-option-active" : "app-segmented-option-idle",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
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
