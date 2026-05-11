import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { AnimatedLogo } from "./AnimatedLogo";
import { INTENT_OPTIONS, ROLE_OPTIONS, WORK_MODE_OPTIONS } from "./constants";
import {
  InlineTooltip,
  OptionChip,
  PrimaryButton,
  RoleChip,
  SecondaryTextButton,
  WelcomeFrame,
  WelcomeHeader,
  type Translate,
  WorkModeOption,
} from "./shared";
import type { WelcomeIntentId, WelcomeRoleId, WelcomeWorkMode } from "./types";

export function SimpleWelcomeCard({
  onContinue,
  t,
}: {
  onContinue: () => void;
  t: Translate;
}) {
  return (
    <div className="app-card w-full max-w-[360px] rounded-[20px] px-6 py-8 text-center shadow-[0_22px_60px_rgba(0,0,0,0.14)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center text-[var(--app-shell-accent)]">
        <AnimatedLogo className="size-14" />
      </div>
      <h1 className="mt-5 text-[28px] leading-[34px] font-normal whitespace-nowrap max-[540px]:whitespace-normal">
        {t("onboarding.welcome.new.title.anon")}
      </h1>
      <p className="mt-3 text-[16px] leading-6 text-[var(--app-shell-subtle)]">
        {t("onboarding.welcome.debugFallback.description")}
      </p>
      <PrimaryButton
        className="mt-8 w-[168px] justify-center px-[16px] py-[8px] text-base leading-6 font-medium"
        onClick={onContinue}
      >
        {t("onboarding.welcome.continue")}
      </PrimaryButton>
    </div>
  );
}

export function IntentSelectionStep({
  onContinue,
  onPersonalizedSuggestionsChange,
  onSkip,
  onToggleIntent,
  personalizedSuggestionsEnabled,
  selectedIntents,
  t,
}: {
  onContinue: () => void;
  onPersonalizedSuggestionsChange: (checked: boolean) => void;
  onSkip: () => void;
  onToggleIntent: (intent: WelcomeIntentId) => void;
  personalizedSuggestionsEnabled: boolean;
  selectedIntents: WelcomeIntentId[];
  t: Translate;
}) {
  return (
    <WelcomeFrame>
      <WelcomeHeader
        subtitle={t("onboarding.welcomeV2.intent.subtitle")}
        title={t("onboarding.welcomeV2.intent.title")}
      />
      <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
        {INTENT_OPTIONS.map((option) => (
          <OptionChip
            key={option.id}
            badge={option.badge}
            label={t(option.labelKey)}
            selected={selectedIntents.includes(option.id)}
            onClick={() => onToggleIntent(option.id)}
          />
        ))}
      </div>
      <PersonalizedSuggestionsRow
        checked={personalizedSuggestionsEnabled}
        onChange={onPersonalizedSuggestionsChange}
        t={t}
      />
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
        <PrimaryButton className="w-full" onClick={onContinue}>
          {t("onboarding.welcome.continue")}
        </PrimaryButton>
        <SecondaryTextButton onClick={onSkip}>{t("onboarding.welcomeV2.skip")}</SecondaryTextButton>
      </div>
    </WelcomeFrame>
  );
}

export function WorkModeSelectionStep({
  isContinueDisabled,
  onChooseWorkMode,
  onContinue,
  selectedWorkMode,
  t,
}: {
  isContinueDisabled: boolean;
  onChooseWorkMode: (workMode: WelcomeWorkMode) => void;
  onContinue: () => void;
  selectedWorkMode: WelcomeWorkMode | null;
  t: Translate;
}) {
  return (
    <WelcomeFrame>
      <WelcomeHeader
        subtitle={t("onboarding.welcomeV2.workMode.subtitle")}
        title={t("onboarding.welcomeV2.workMode.title")}
        titleId="welcome-v2-work-mode-title"
      />
      <div
        aria-labelledby="welcome-v2-work-mode-title"
        className="mt-8 flex w-full max-w-xs flex-col gap-1"
        role="radiogroup"
      >
        {WORK_MODE_OPTIONS.map((option) => (
          <WorkModeOption
            key={option.id}
            badge={option.badge}
            description={t(option.descriptionKey)}
            selected={selectedWorkMode === option.id}
            title={t(option.titleKey)}
            onClick={() => onChooseWorkMode(option.id)}
          />
        ))}
      </div>
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
        <PrimaryButton className="w-full" disabled={isContinueDisabled} onClick={onContinue}>
          {t("onboarding.welcome.continue")}
        </PrimaryButton>
        <p className="mt-1 text-center text-sm leading-normal text-[var(--app-shell-subtle)]">
          {t("onboarding.welcomeV2.workMode.settingsHint")}
        </p>
      </div>
    </WelcomeFrame>
  );
}

export function RoleSelectionStep({
  isContinueDisabled,
  onContinue,
  onPersonalizedSuggestionsChange,
  onSkip,
  onToggleRole,
  personalizedSuggestionsEnabled,
  selectedRoles,
  t,
}: {
  isContinueDisabled: boolean;
  onContinue: () => void;
  onPersonalizedSuggestionsChange: (checked: boolean) => void;
  onSkip: () => void;
  onToggleRole: (role: WelcomeRoleId) => void;
  personalizedSuggestionsEnabled: boolean;
  selectedRoles: WelcomeRoleId[];
  t: Translate;
}) {
  return (
    <WelcomeFrame>
      <WelcomeHeader
        subtitle={t("onboarding.welcomeV2.role.subtitle")}
        title={t("onboarding.welcomeV2.role.title")}
      />
      <div className="mt-8 grid w-full grid-cols-2 gap-2">
        {ROLE_OPTIONS.map((option) => (
          <RoleChip
            key={option.id}
            label={t(option.labelKey)}
            selected={selectedRoles.includes(option.id)}
            onClick={() => onToggleRole(option.id)}
          />
        ))}
      </div>
      <PersonalizedSuggestionsRow
        checked={personalizedSuggestionsEnabled}
        onChange={onPersonalizedSuggestionsChange}
        t={t}
      />
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
        <PrimaryButton className="w-full" disabled={isContinueDisabled} onClick={onContinue}>
          {t("onboarding.welcome.continue")}
        </PrimaryButton>
        <SecondaryTextButton onClick={onSkip}>{t("onboarding.welcomeV2.skip")}</SecondaryTextButton>
      </div>
    </WelcomeFrame>
  );
}

function PersonalizedSuggestionsRow({
  checked,
  onChange,
  t,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  t: Translate;
}) {
  const title = t("onboarding.welcomeV2.personalizedSuggestions.title");
  const description = t("onboarding.welcomeV2.personalizedSuggestions.description");

  return (
    <div className="mt-7 flex items-center justify-center gap-2">
      <ToggleSwitch
        ariaLabel={t("onboarding.welcomeV2.personalizedSuggestions.toggle")}
        checked={checked}
        disabled={false}
        onChange={onChange}
      />
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-pressed={checked}
          className="cursor-pointer text-sm leading-5 font-normal text-[var(--app-shell-text)]"
          onClick={() => onChange(!checked)}
        >
          {title}
        </button>
        <InlineTooltip label={t("onboarding.welcomeV2.personalizedSuggestions.info")} content={description} />
      </div>
    </div>
  );
}
