import { useEffect, useState } from "react";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { describeExternalAgentImportGroupSelection } from "./importModel";
import { PROVIDER_LABEL_KEYS } from "./constants";
import {
  WelcomeImportChatsIcon,
  WelcomeImportChoiceIcon as WelcomeImportChoiceGlyph,
  WelcomeImportProjectsIcon,
  WelcomeImportProviderIcon,
  WelcomeImportSettingsIcon,
} from "./icons";
import {
  InlineError,
  ImportGroupRow,
  PrimaryButton,
  SecondaryTextButton,
  SelectionBadge,
  SelectionCheckbox,
  WelcomeFrame,
  WelcomeImportHeader,
  type Translate,
} from "./shared";
import type {
  ExternalAgentProviderId,
  WelcomeImportChoice,
  WelcomeImportGroup,
  WelcomeImportSelection,
  WelcomeImportSummary,
} from "./types";

export function ExternalAgentImportProviderStep({
  onContinue,
  onSkip,
  onToggleProvider,
  providerIds,
  selectedProviders,
  t,
}: {
  onContinue: () => void;
  onSkip: () => void;
  onToggleProvider: (providerId: ExternalAgentProviderId) => void;
  providerIds: ExternalAgentProviderId[];
  selectedProviders: ExternalAgentProviderId[];
  t: Translate;
}) {
  return (
    <WelcomeFrame panelClassName="max-w-lg">
      <WelcomeImportHeader
        sourceIconVariant="neutral"
        subtitle={t("onboarding.welcomeV2.externalAgentImport.providers.subtitle")}
        title={t("onboarding.welcomeV2.externalAgentImport.providers.title")}
      />
      <div className="mt-8 flex w-full max-w-sm flex-col">
        <div className="mb-2 text-xs leading-4 font-medium text-[var(--app-shell-subtle)]">
          {t("onboarding.welcomeV2.externalAgentImport.providers.appsFound")}
        </div>
        <div
          aria-label={t("onboarding.welcomeV2.externalAgentImport.providers.list")}
          className="overflow-hidden rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)]"
          role="list"
        >
          {providerIds.map((providerId) => (
            <ProviderRow
              key={providerId}
              providerId={providerId}
              selected={selectedProviders.includes(providerId)}
              t={t}
              onToggle={() => onToggleProvider(providerId)}
            />
          ))}
        </div>
        <div className="mt-2 text-center text-xs leading-4 text-[var(--app-shell-subtle)]">
          {t("onboarding.welcomeV2.externalAgentImport.providers.standardChatsUnsupported")}
        </div>
      </div>
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
        <PrimaryButton className="w-full" onClick={onContinue}>
          {t("onboarding.welcome.continue")}
        </PrimaryButton>
        <SecondaryTextButton className="h-12 w-full rounded-full px-4 py-3" onClick={onSkip}>
          {t("onboarding.welcomeV2.skip")}
        </SecondaryTextButton>
      </div>
    </WelcomeFrame>
  );
}

export function ExternalAgentImportItemsStep({
  errorMessage,
  isPending,
  isContinueDisabled,
  onContinue,
  onOpenCustomize,
  onSkip,
  onToggleChats,
  onToggleGroup,
  selection,
  summary,
  t,
}: {
  errorMessage: string | null;
  isPending: boolean;
  isContinueDisabled: boolean;
  onContinue: () => void;
  onOpenCustomize: () => void;
  onSkip: () => void;
  onToggleChats: () => void;
  onToggleGroup: (group: WelcomeImportGroup) => void;
  selection: WelcomeImportSelection;
  summary: WelcomeImportSummary;
  t: Translate;
}) {
  const toolsState = describeExternalAgentImportGroupSelection(summary, selection, "toolsAndSetup");
  const projectState = describeExternalAgentImportGroupSelection(summary, selection, "projects");
  const chatsSelected = summary.chatChoiceKey != null && selection[summary.chatChoiceKey] === true;

  return (
    <WelcomeFrame panelClassName="max-w-lg">
      <WelcomeImportHeader
        subtitle={t("onboarding.welcomeV2.externalAgentImport.items.subtitle")}
        title={t("onboarding.welcomeV2.externalAgentImport.items.title")}
      />
      <div className="mt-8 flex w-full max-w-sm flex-col">
        <div className="mb-2 text-xs leading-4 font-medium text-[var(--app-shell-subtle)]">
          {t("onboarding.welcomeV2.externalAgentImport.items.list")}
        </div>
        <div className="w-full overflow-hidden rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)]">
          {summary.toolsAndSetupCount > 0 ? (
            <ImportGroupRow
              description={t("onboarding.welcomeV2.externalAgentImport.toolsAndSetup.description")}
              disabled={isPending}
              leadingContent={<WelcomeImportSettingsIcon className="size-5" />}
              label={t("onboarding.welcomeV2.externalAgentImport.toolsAndSetup.title")}
              onCheckedChange={(checked) => handleGroupSelection("toolsAndSetup", checked)}
              state={toolsState}
            />
          ) : null}
          {summary.projectCount > 0 ? (
            <ImportGroupRow
              description={t("onboarding.welcomeV2.externalAgentImport.projects.description")}
              disabled={isPending}
              leadingContent={<WelcomeImportProjectsIcon className="size-5" />}
              label={t("onboarding.welcomeV2.externalAgentImport.projects.title", { count: summary.projectCount })}
              onCheckedChange={(checked) => handleGroupSelection("projects", checked)}
              state={projectState}
            />
          ) : null}
          {summary.recentChatCount > 0 ? (
            <ImportGroupRow
              description={t("onboarding.welcomeV2.externalAgentImport.recentChats.description")}
              disabled={isPending}
              leadingContent={<WelcomeImportChatsIcon className="size-5" />}
              label={t("onboarding.welcomeV2.externalAgentImport.recentChats.title", {
                count: summary.recentChatCount,
              })}
              onCheckedChange={(checked) => onToggleChatsWithValue(checked)}
              state={chatsSelected ? "all" : "none"}
            />
          ) : null}
        </div>
      </div>
      {summary.bothProvidersNote ? (
        <div className="mt-2 text-center text-xs leading-4 text-[var(--app-shell-subtle)]">
          {t("onboarding.welcomeV2.externalAgentImport.items.bothProvidersNote")}
        </div>
      ) : null}
      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-4">
        {errorMessage ? <InlineError message={errorMessage} /> : null}
        {summary.customizeItems.length > 0 ? (
          <button
            type="button"
            className="flex h-8 w-full items-center justify-center rounded-full px-3 text-[14px] leading-5 font-medium text-[var(--app-shell-subtle)] transition hover:text-[var(--app-shell-text)] disabled:cursor-default disabled:opacity-40"
            disabled={isPending}
            onClick={onOpenCustomize}
          >
            {t("onboarding.welcomeV2.externalAgentImport.customize")}
          </button>
        ) : null}
        <PrimaryButton className="w-full max-w-xs" disabled={isPending || isContinueDisabled} onClick={onContinue}>
          {t("onboarding.welcome.continue")}
        </PrimaryButton>
        <SecondaryTextButton className="h-8 w-full px-3" disabled={isPending} onClick={onSkip}>
          {t("onboarding.welcomeV2.skip")}
        </SecondaryTextButton>
      </div>
    </WelcomeFrame>
  );

  function handleGroupSelection(group: WelcomeImportGroup, checked: boolean) {
    const nextState = checked ? "all" : "none";
    const currentState = group === "toolsAndSetup" ? toolsState : projectState;
    if (currentState === nextState) {
      return;
    }

    onToggleGroup(group);
  }

  function onToggleChatsWithValue(checked: boolean) {
    if (checked === chatsSelected) {
      return;
    }

    onToggleChats();
  }
}

export function ExternalAgentImportCustomizeDialog({
  items,
  onClose,
  onConfirm,
  selectedItemIds,
  t,
}: {
  items: WelcomeImportChoice[];
  onClose: () => void;
  onConfirm: (nextSelectedIds: WelcomeImportSelection) => void;
  selectedItemIds: WelcomeImportSelection;
  t: Translate;
}) {
  const [draftSelectedIds, setDraftSelectedIds] = useState<WelcomeImportSelection>(selectedItemIds);

  useEffect(() => {
    setDraftSelectedIds(selectedItemIds);
  }, [selectedItemIds]);

  const hasSelection = items.some((item) => draftSelectedIds[item.id] === true);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4" onClick={onClose}>
      <div
        className="app-card w-full max-w-[400px] rounded-[20px] px-4 py-4 shadow-[0_18px_46px_rgba(0,0,0,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="pr-10 text-[18px] leading-8 font-normal text-[var(--app-shell-text)]">
          {t("onboarding.welcomeV2.externalAgentImport.customize.title")}
        </h2>
        <p className="sr-only">{t("onboarding.welcomeV2.externalAgentImport.customize.description")}</p>
        <div className="mt-4 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
          {items.map((item) => {
            const checked = draftSelectedIds[item.id] === true;

            return (
              <label key={item.id} className="relative flex h-12 cursor-pointer items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--app-shell-text)_5%,transparent)] text-[var(--app-shell-subtle)]">
                    <WelcomeImportChoiceGlyph className="size-5" icon={item.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] leading-[17px] font-normal text-[var(--app-shell-text)]">
                      {item.title}
                    </div>
                    <div className="mt-1 truncate text-[12px] leading-[14px] text-[var(--app-shell-subtle)]">
                      {item.description}
                    </div>
                  </div>
                </div>
                <div className="ml-3">
                  <SelectionCheckbox
                    checked={checked}
                    className=""
                    label={item.title}
                    onChange={(isChecked) =>
                      setDraftSelectedIds((current) => ({
                        ...current,
                        [item.id]: isChecked,
                      }))
                    }
                  />
                </div>
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex h-7 items-center justify-end">
          <button
            type="button"
            className={[
              "h-7 rounded-[10px] px-2 text-[13px] leading-6 font-medium text-[var(--app-shell-main-surface)]",
              hasSelection
                ? "bg-[var(--app-shell-text)]"
                : "cursor-not-allowed bg-[color-mix(in_srgb,var(--app-shell-text)_28%,transparent)]",
            ].join(" ")}
            disabled={!hasSelection}
            onClick={() => onConfirm(draftSelectedIds)}
          >
            {t("onboarding.welcomeV2.externalAgentImport.customize.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  providerId,
  selected,
  t,
  onToggle,
}: {
  providerId: ExternalAgentProviderId;
  selected: boolean;
  t: Translate;
  onToggle: () => void;
}) {
  const label = t(PROVIDER_LABEL_KEYS[providerId]);

  return (
    <div
      role="listitem"
      className="flex min-h-16 items-center gap-3 border-b border-[var(--app-shell-border)] px-3 py-3 last:border-b-0"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#DA6A44] text-white ring-1 ring-[var(--app-shell-border)]">
        <WelcomeImportProviderIcon className="size-10" providerId={providerId} />
      </div>
      <div className="min-w-0 flex-1 text-base leading-6 text-[var(--app-shell-text)]">{label}</div>
      <ToggleSwitch
        ariaLabel={t("onboarding.welcomeV2.externalAgentImport.providers.toggle", {
          provider: label,
        })}
        checked={selected}
        disabled={false}
        onChange={onToggle}
      />
    </div>
  );
}
