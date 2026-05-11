import { useState, type MouseEvent, type ReactNode, type SVGProps } from "react";
import { MESSAGES, getMessageLocale, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import { setGlobalState } from "../../services/settings";
import { FirstRunButton } from "./FirstRunButton";
import { FirstRunAsciiBackground } from "./FirstRunAsciiBackground";

const INTRO_STEP = 0;
const CLOUD_STEP = 1;
const TODO_STEP = 2;
const LEGAL_STEP = 3;
const LAST_STEP = LEGAL_STEP;

const NUX_2025_09_15 = "viewed2025-09-15-nux";
const NUX_2025_09_15_FULL_CHATGPT_AUTH_VIEWED = "viewed2025-09-15-full-chatgpt-auth-nux";
const NUX_2025_09_15_APIKEY_AUTH_VIEWED = "viewed2025-09-15-apikey-auth-nux";
const CODEX_IDE_DOCS_URL = "https://developers.openai.com/codex/ide";
const OPENAI_CODEX_TOS_URL = "https://openai.com/policies/row-terms-of-use/";
const GITHUB_TOS_URL = "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service";
const CHATGPT_DATA_CONTROLS_URL = "https://chatgpt.com/#settings/DataControls";
const INTRO_SNIPPET = `import mongoose, { Schema } from "mongoose";
export const collection = "Product";`;
const TODO_HEADING_SNIPPET = `const schema = new Schema(`;
const TODO_SCHEMA_SNIPPET = `  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {`;

type FirstRunNuxVariant = "none" | "2025-09-15-full-chatgpt-auth" | "2025-09-15-apikey-auth";
type Translate = (key: MessageKey, values?: MessageValues) => string;

type FirstRunPageProps = {
  authMethod: string | null;
  locale: LocaleCode;
  onAccept: () => void | Promise<void>;
  t: Translate;
};

export function FirstRunPage({ authMethod, locale, onAccept, t }: FirstRunPageProps) {
  const hasCloudAccess = authMethod === "chatgpt";
  const isUsingCopilotAuth = authMethod === "copilot";
  const nuxVariant = readCurrentNuxVariant();
  const initialStep =
    nuxVariant === "2025-09-15-full-chatgpt-auth"
      ? INTRO_STEP
      : nuxVariant === "2025-09-15-apikey-auth"
        ? LEGAL_STEP
        : hasCloudAccess
          ? INTRO_STEP
          : LEGAL_STEP;
  const [step, setStep] = useState(initialStep);
  const [isSaving, setIsSaving] = useState(false);

  const title =
    step === INTRO_STEP
      ? t("codex.legal.step.intro.title")
      : step === CLOUD_STEP
        ? t("codex.legal.step.cloud.title")
        : step === TODO_STEP
          ? t("codex.legal.step.todo.title")
          : null;
  const subtitle =
    step === INTRO_STEP
      ? t("codex.legal.step.intro.subtitle")
      : step === CLOUD_STEP
        ? t("codex.legal.step.cloud.subtitle")
        : step === TODO_STEP
          ? t("codex.legal.step.todo.subtitle")
          : null;
  const slideVariant = step === INTRO_STEP ? "intro" : step === CLOUD_STEP ? "cloud" : step === TODO_STEP ? "todo" : null;

  const handleBack = () => {
    setStep((current) => Math.max(INTRO_STEP, current - 1));
  };

  const handleContinue = async () => {
    if (isSaving) {
      return;
    }

    if (step !== LEGAL_STEP) {
      setStep((current) => Math.min(LAST_STEP, current + 1));
      return;
    }

    setIsSaving(true);
    try {
      await setGlobalState(NUX_2025_09_15, true);
      if (nuxVariant === "2025-09-15-full-chatgpt-auth") {
        await setGlobalState(NUX_2025_09_15_FULL_CHATGPT_AUTH_VIEWED, true);
      } else if (nuxVariant === "2025-09-15-apikey-auth") {
        await setGlobalState(NUX_2025_09_15_APIKEY_AUTH_VIEWED, true);
      }
      await Promise.resolve(onAccept());
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative h-full overflow-hidden bg-[var(--color-background-panel)] text-[var(--color-text-foreground)]">
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-[var(--app-shell-toolbar)]" />
      <BackgroundCode />

      <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-4">
        {slideVariant ? (
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 [@media(max-height:500px)]:hidden">
            <SlidePreview t={t} variant={slideVariant} />
          </div>
        ) : null}

        <div className="absolute bottom-10 left-1/2 z-20 w-full max-w-lg -translate-x-1/2 px-6">
          {title ? (
            <div className="mb-2 flex items-center justify-center">
              <h1 className="mx-auto w-full max-w-sm text-center text-base leading-tight font-medium text-[var(--color-text-foreground)]">
                {title}
              </h1>
            </div>
          ) : null}

          <div className="flex justify-center px-2">
            {step === LEGAL_STEP ? (
              <LegalDetails isUsingCopilotAuth={isUsingCopilotAuth} locale={locale} t={t} />
            ) : (
              <div className="mx-auto w-full max-w-sm text-center text-base text-[var(--color-text-foreground-secondary)]">
                {subtitle}
              </div>
            )}
          </div>

          <div className="mt-10 mb-0 px-2">
            <div className="mx-auto flex w-full max-w-[400px] items-center justify-between gap-2">
              {hasCloudAccess ? (
                <FirstRunButton
                  color="outline"
                  onClick={handleBack}
                  disabled={step === INTRO_STEP || isSaving}
                >
                  {t("codex.legal.backButton")}
                </FirstRunButton>
              ) : null}
              <FirstRunButton onClick={() => void handleContinue()} disabled={isSaving}>
                {hasCloudAccess ? t("codex.legal.continueButton") : t("codex.legal.continue.apikey")}
              </FirstRunButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function BackgroundCode() {
  return <FirstRunAsciiBackground />;
}

function SlidePreview({ t, variant }: { t: Translate; variant: "intro" | "cloud" | "todo" }) {
  if (variant === "intro") {
    return (
      <div className="h-[240px] w-[320px] lg:h-[320px] lg:w-[560px]">
        <div className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-elevated-primary)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
          <div className="pt-2 pl-2 text-base text-[var(--color-text-foreground-secondary)] opacity-40">
            {t("composer.placeholder.newTask.doAnything")}
          </div>
          <div className="mt-auto flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-[5px]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-elevated-secondary)]">
                <PlusIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex h-8 w-[34px] items-center justify-center rounded-full bg-[var(--color-text-foreground)]">
              <ArrowUpIcon className="h-4 w-4 text-[var(--color-background-surface)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "cloud") {
    return (
      <div className="h-[240px] w-[320px] lg:h-[320px] lg:w-[560px]">
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-elevated-primary)] px-4 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
          <SendToCloudIcon className="h-8 w-8" />
          <CloudTaskRow
            icon={<SpinnerBadge />}
            meta={t("codex.legal.cloud.taskOne.meta")}
            title={t("codex.legal.cloud.taskOne.title")}
          />
          <CloudTaskRow
            icon={<CheckIcon className="h-4 w-4" />}
            meta={t("codex.legal.cloud.taskTwo.meta")}
            title={t("codex.legal.cloud.taskTwo.title")}
            trailing={
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-[#179c52]">{t("codex.legal.cloud.taskTwo.stats.positive")}</span>
                <span className="text-[#d85b59]">{t("codex.legal.cloud.taskTwo.stats.negative")}</span>
              </div>
            }
          />
          <CloudTaskRow
            icon={<CheckIcon className="h-4 w-4" />}
            meta={t("codex.legal.cloud.taskThree.meta")}
            title={t("codex.legal.cloud.taskThree.title")}
            trailing={
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-[#179c52]">{t("codex.legal.cloud.taskThree.stats.positive")}</span>
                <span className="text-[#d85b59]">{t("codex.legal.cloud.taskThree.stats.negative")}</span>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[240px] w-[320px] lg:h-[320px] lg:w-[560px]">
      <div className="rounded-xl bg-[var(--color-background-elevated-primary)] p-2 font-mono shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <CodeBlock>{INTRO_SNIPPET}</CodeBlock>
        <div className="mt-2 rounded-xl bg-[var(--color-background-elevated-primary)] p-2 pb-2.5">
          <span className="px-2 py-1 text-xs tracking-[0.2em] text-[var(--color-text-foreground-secondary)] uppercase">
            {t("codex.legal.todo.heading")}
          </span>
        </div>
        <CodeBlock>{`${TODO_HEADING_SNIPPET}\n${TODO_SCHEMA_SNIPPET}`}</CodeBlock>
      </div>
    </div>
  );
}

function LegalDetails({
  isUsingCopilotAuth,
  locale,
  t,
}: {
  isUsingCopilotAuth: boolean;
  locale: LocaleCode;
  t: Translate;
}) {
  return (
    <ul className="mt-3 space-y-4 overflow-y-auto">
      <InfoRow
        icon={<AutonomyIcon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />}
        title={t("codex.legal.autonomy.title")}
      >
        <InlineTemplateWithLink
          href={CODEX_IDE_DOCS_URL}
          locale={locale}
          linkKeyName="codex.legal.autonomy.details.link"
          templateKeyName="codex.legal.autonomy.details"
        />
      </InfoRow>
      <InfoRow icon={<InfoIcon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />} title={t("codex.legal.mistakes.title")}>
        {t("codex.legal.mistakes.review")}
      </InfoRow>
      <InfoRow
        icon={
          isUsingCopilotAuth ? (
            <GitHubMarkIcon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />
          ) : (
            <OpenAIBlossomIcon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />
          )
        }
        title={isUsingCopilotAuth ? t("codex.legal.copilot.title") : t("codex.legal.powered.title")}
      >
        {isUsingCopilotAuth ? (
          <InlineTemplateWithTwoLinks
            firstHref={OPENAI_CODEX_TOS_URL}
            firstKeyName="codex.legal.copilot.oaiTosLink"
            locale={locale}
            secondHref={GITHUB_TOS_URL}
            secondKeyName="codex.legal.copilot.gitHubTosLink"
            templateKeyName="codex.legal.copilot.details"
          />
        ) : (
          <InlineTemplateWithLink
            href={CHATGPT_DATA_CONTROLS_URL}
            locale={locale}
            linkKeyName="codex.legal.powered.details.link"
            templateKeyName="codex.legal.powered.details"
          />
        )}
      </InfoRow>
    </ul>
  );
}

function InfoRow({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <li className="flex items-start gap-3">
      {icon}
      <div className="text-sm">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-base text-[var(--color-text-foreground-secondary)]">{children}</span>
      </div>
    </li>
  );
}

function InlineTemplateWithLink({
  href,
  locale,
  linkKeyName,
  templateKeyName,
}: {
  href: string;
  locale: LocaleCode;
  linkKeyName: MessageKey;
  templateKeyName: MessageKey;
}) {
  const messages = MESSAGES[getMessageLocale(locale)];
  const template = messages[templateKeyName];
  const [beforeLink, afterLink = ""] = template.split("{link}");

  return (
    <>
      {beforeLink}
      <a href={href} onClick={preventNavigation} className="underline hover:no-underline">
        {messages[linkKeyName]}
      </a>
      {afterLink}
    </>
  );
}

function InlineTemplateWithTwoLinks({
  firstHref,
  firstKeyName,
  locale,
  secondHref,
  secondKeyName,
  templateKeyName,
}: {
  firstHref: string;
  firstKeyName: MessageKey;
  locale: LocaleCode;
  secondHref: string;
  secondKeyName: MessageKey;
  templateKeyName: MessageKey;
}) {
  const messages = MESSAGES[getMessageLocale(locale)];
  const template = messages[templateKeyName];
  const [beforeFirst, afterFirst = ""] = template.split("{oaiTos}");
  const [betweenLinks, afterSecond = ""] = afterFirst.split("{gitHubTos}");

  return (
    <>
      {beforeFirst}
      <a href={firstHref} onClick={preventNavigation} className="underline hover:no-underline">
        {messages[firstKeyName]}
      </a>
      {betweenLinks}
      <a href={secondHref} onClick={preventNavigation} className="underline hover:no-underline">
        {messages[secondKeyName]}
      </a>
      {afterSecond}
    </>
  );
}

function CloudTaskRow({
  icon,
  meta,
  title,
  trailing = null,
}: {
  icon: ReactNode;
  meta: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      {icon}
      <div className="flex flex-1 flex-col text-[var(--color-text-foreground)]">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm font-medium opacity-50">{meta}</div>
      </div>
      {trailing}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-hidden rounded-xl bg-[var(--color-background-surface)] px-3 py-3 text-xs leading-6 whitespace-pre-wrap text-[var(--color-text-foreground)]">
      {children}
    </pre>
  );
}

function SpinnerBadge() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border border-[var(--color-text-foreground-secondary)] border-r-transparent" />
  );
}

function readCurrentNuxVariant(): FirstRunNuxVariant {
  // Current upstream baseline `use-nux-CmT8qTYY.js` returns `none`.
  return "none";
}

function preventNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

function AutonomyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M10 13.2135C11.7333 13.2136 13.331 13.7149 14.5117 14.5582C15.691 15.4006 16.4989 16.6247 16.499 18.0455C16.4988 18.4125 16.2009 18.7103 15.834 18.7106C15.4668 18.7106 15.1691 18.4127 15.1689 18.0455C15.1688 17.1656 14.6699 16.3057 13.7383 15.6403C12.8078 14.9757 11.488 14.5436 10 14.5436C8.51211 14.5436 7.19214 14.9758 6.26172 15.6403C5.33026 16.3057 4.83215 17.1657 4.83203 18.0455C4.83186 18.4126 4.53404 18.7104 4.16699 18.7106C3.79983 18.7106 3.50213 18.4127 3.50195 18.0455C3.50207 16.6246 4.3099 15.4006 5.48926 14.5582C6.66991 13.715 8.26685 13.2136 10 13.2135Z"
        fill="currentColor"
      />
      <path
        d="M7.91699 5.54553C8.60724 5.54566 9.16699 6.10526 9.16699 6.79553C9.16699 7.48581 8.60724 8.0454 7.91699 8.04553C7.22664 8.04553 6.66699 7.48589 6.66699 6.79553C6.66699 6.10518 7.22664 5.54553 7.91699 5.54553Z"
        fill="currentColor"
      />
      <path
        d="M12.083 5.54553C12.7734 5.54553 13.333 6.10518 13.333 6.79553C13.333 7.48589 12.7734 8.04553 12.083 8.04553C11.3928 8.0454 10.833 7.48581 10.833 6.79553C10.833 6.10526 11.3928 5.54566 12.083 5.54553Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 1.54749C10.3673 1.54749 10.665 1.84526 10.665 2.21252V2.79749H13.1113C13.554 2.79749 13.9248 2.7969 14.2275 2.82092C14.5377 2.84557 14.8331 2.89914 15.1143 3.03772C15.5745 3.26474 15.9478 3.63796 16.1748 4.09827C16.3133 4.37938 16.367 4.67495 16.3916 4.98499C16.4156 5.28762 16.415 5.65872 16.415 6.1012C16.415 6.99761 16.4157 7.70971 16.3701 8.28284C16.324 8.86308 16.2274 9.35876 16.0029 9.81409C15.6137 10.6032 14.9746 11.2422 14.1855 11.6315C13.73 11.8561 13.2339 11.9525 12.6533 11.9987C12.0802 12.0442 11.369 12.0446 10.4727 12.0446H9.52734C8.631 12.0446 7.91978 12.0442 7.34668 11.9987C6.76612 11.9525 6.26997 11.8561 5.81445 11.6315C5.02538 11.2422 4.38629 10.6032 3.99707 9.81409C3.77258 9.35876 3.67603 8.86308 3.62988 8.28284C3.58434 7.70971 3.58496 6.99761 3.58496 6.1012C3.58496 5.65872 3.5844 5.28762 3.6084 4.98499C3.63303 4.67495 3.6867 4.37938 3.8252 4.09827C4.05219 3.63796 4.42545 3.26474 4.88574 3.03772C5.16693 2.89914 5.46234 2.84557 5.77246 2.82092C6.07515 2.7969 6.44604 2.79749 6.88867 2.79749H9.33496V2.21252C9.33496 1.84526 9.63273 1.54749 10 1.54749ZM6.88867 4.12756C6.42452 4.12756 6.11484 4.12819 5.87695 4.14709C5.64679 4.16542 5.54082 4.19795 5.47363 4.23108C5.27602 4.3286 5.11605 4.48852 5.01855 4.68616C4.98547 4.75336 4.95287 4.85959 4.93457 5.08948C4.91569 5.32732 4.91504 5.63725 4.91504 6.1012C4.91504 7.01891 4.91567 7.66913 4.95605 8.17737C4.99587 8.67788 5.07138 8.98479 5.19043 9.2262C5.45025 9.75279 5.87667 10.1794 6.40332 10.4391C6.64477 10.5581 6.9515 10.6337 7.45215 10.6735C7.96034 10.7138 8.60976 10.7145 9.52734 10.7145H10.4727C11.3902 10.7145 12.0397 10.7138 12.5479 10.6735C13.0485 10.6337 13.3552 10.5581 13.5967 10.4391C14.1233 10.1794 14.5498 9.75279 14.8096 9.2262C14.9286 8.98479 15.0041 8.67788 15.0439 8.17737C15.0843 7.66913 15.085 7.01891 15.085 6.1012C15.085 5.63725 15.0843 5.32732 15.0654 5.08948C15.0471 4.85959 15.0145 4.75336 14.9814 4.68616C14.884 4.48852 14.724 4.3286 14.5264 4.23108C14.4592 4.19795 14.3532 4.16542 14.123 4.14709C13.8852 4.12819 13.5755 4.12756 13.1113 4.12756H6.88867Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M10.6 9.70459C11.0142 9.70461 11.35 10.0404 11.35 10.4546V13.7876C11.35 14.2018 11.0142 14.5376 10.6 14.5376C10.1858 14.5376 9.84998 14.2018 9.84998 13.7876V10.4546C9.84998 10.0404 10.1858 9.70459 10.6 9.70459Z"
        fill="currentColor"
      />
      <path
        d="M10.6 6.2876C11.1292 6.28762 11.558 6.71732 11.558 7.24658C11.5578 7.77569 11.1291 8.20457 10.6 8.20459C10.0708 8.20459 9.64215 7.7757 9.64197 7.24658C9.64197 6.71731 10.0707 6.2876 10.6 6.2876Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6 2.53955C14.9713 2.53955 18.515 6.08326 18.515 10.4546C18.515 14.8259 14.9713 18.3696 10.6 18.3696C6.22864 18.3696 2.68494 14.8259 2.68494 10.4546C2.68494 6.08326 6.22864 2.53955 10.6 2.53955ZM10.6 3.86963C6.96318 3.86963 4.01501 6.81779 4.01501 10.4546C4.01501 14.0914 6.96318 17.0396 10.6 17.0396C14.2368 17.0396 17.1849 14.0914 17.1849 10.4546C17.1849 6.81779 14.2368 3.86963 10.6 3.86963Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12.8961 3.64101C13.1297 3.41418 13.4984 3.37523 13.7779 3.56581C14.0571 3.75635 14.1554 4.11331 14.0299 4.41347L13.9615 4.53847L7.71151 13.7045C7.59411 13.8767 7.4063 13.9877 7.19881 14.0072C6.99136 14.0267 6.78564 13.9533 6.63826 13.806L2.88826 10.056L2.79842 9.9457C2.6192 9.67407 2.64927 9.30496 2.88826 9.06581C3.12738 8.82669 3.49647 8.79676 3.76815 8.97597L3.8785 9.06581L7.03084 12.2182L12.8053 3.74941L12.8961 3.64101Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SendToCloudIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M15.0001 14.9967C16.841 14.9967 18.3334 13.5044 18.3334 11.6634C18.3334 9.82246 16.841 8.33008 15.0001 8.33008C15.0001 5.56865 12.7615 3.33008 10.0001 3.33008C7.80904 3.33008 5.94715 4.73939 5.27148 6.70098C3.23605 6.97537 1.66675 8.71946 1.66675 10.8301C1.66675 12.8458 3.09817 14.5273 5 14.9134"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 12.5L10 10L12.5 12.5"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 10.5V17"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.33467 16.6663V4.93978L4.6374 9.63704L4.1667 9.16634L3.69599 8.69661L9.52998 2.86263L9.63447 2.77767C9.8925 2.60753 10.2433 2.63564 10.4704 2.86263L16.3034 8.69661L16.3884 8.80111C16.5588 9.05922 16.5306 9.40982 16.3034 9.63704C16.0762 9.86414 15.7255 9.89242 15.4675 9.722L15.363 9.63704L10.6647 4.9388V16.6663C10.6647 17.0336 10.367 17.3314 9.99971 17.3314C9.63259 17.3312 9.33467 17.0335 9.33467 16.6663ZM4.6374 9.63704C4.3777 9.89674 3.95569 9.89674 3.69599 9.63704C3.43657 9.37744 3.43668 8.95628 3.69599 8.69661L4.6374 9.63704Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GitHubMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.99996 2.08002C14.373 2.08002 17.915 5.62198 17.915 9.99502C17.9145 11.6534 17.3941 13.2699 16.4268 14.617C15.4595 15.9641 14.0941 16.9739 12.5229 17.5044C12.1271 17.5835 11.9787 17.3362 11.9787 17.1284C11.9787 16.8613 11.9886 16.0104 11.9886 14.9518C11.9886 14.2098 11.7413 13.7349 11.4543 13.4875C13.2154 13.2896 15.0656 12.6169 15.0656 9.57948C15.0656 8.70883 14.7589 8.00637 14.2543 7.45232C14.3334 7.25445 14.6104 6.44316 14.1751 5.35485C14.1751 5.35485 13.5122 5.13719 11.9985 6.16614C11.3653 5.98805 10.6925 5.899 10.0197 5.899C9.34697 5.899 8.6742 5.98805 8.041 6.16614C6.52726 5.14708 5.86437 5.35485 5.86437 5.35485C5.42905 6.44316 5.70607 7.25445 5.78522 7.45232C5.28064 8.00637 4.97394 8.71872 4.97394 9.57948C4.97394 12.607 6.81417 13.2896 8.57526 13.4875C8.3477 13.6854 8.13994 14.0317 8.07068 14.5461C7.61557 14.7539 6.47779 15.0903 5.76544 13.8932C5.61703 13.6557 5.17181 13.072 4.54851 13.0819C3.88562 13.0918 4.28137 13.4578 4.5584 13.6062C4.89479 13.7942 5.28064 14.4967 5.36969 14.7242C5.52799 15.1694 6.04246 16.0203 8.03111 15.6542C8.03111 16.3171 8.041 16.9404 8.041 17.1284C8.041 17.3362 7.89259 17.5736 7.49684 17.5044C5.92041 16.9796 4.54923 15.9718 3.57782 14.6239C2.60641 13.276 2.08409 11.6565 2.08496 9.99502C2.08496 5.62198 5.62692 2.08002 9.99996 2.08002Z"
        fill="currentColor"
      />
    </svg>
  );
}

function OpenAIBlossomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M11.6475 18.3409C11.0975 18.3409 10.575 18.2364 10.08 18.0274C9.58502 17.8184 9.14502 17.5269 8.76002 17.1529C8.34202 17.2959 7.90751 17.3674 7.45651 17.3674C6.71951 17.3674 6.03751 17.1859 5.41051 16.8229C4.78351 16.4599 4.27751 15.9649 3.89251 15.3379C3.51851 14.7109 3.33151 14.0124 3.33151 13.2424C3.33151 12.9234 3.37551 12.5769 3.46351 12.2029C3.02351 11.7959 2.68251 11.3284 2.44051 10.8004C2.19851 10.2614 2.07751 9.70044 2.07751 9.11744C2.07751 8.52344 2.20401 7.95144 2.45701 7.40144C2.71001 6.85144 3.06201 6.37844 3.51301 5.98244C3.97501 5.57544 4.50851 5.29494 5.11351 5.14094C5.23451 4.51394 5.48751 3.95294 5.87251 3.45794C6.26851 2.95194 6.75252 2.55594 7.32452 2.26994C7.89652 1.98394 8.50702 1.84094 9.15602 1.84094C9.70602 1.84094 10.2285 1.94544 10.7235 2.15444C11.2185 2.36344 11.6585 2.65494 12.0435 3.02894C12.4615 2.88594 12.896 2.81444 13.347 2.81444C14.084 2.81444 14.766 2.99594 15.393 3.35894C16.02 3.72194 16.5205 4.21694 16.8945 4.84394C17.2795 5.47094 17.472 6.16944 17.472 6.93944C17.472 7.25844 17.428 7.60494 17.34 7.97894C17.78 8.38594 18.121 8.85894 18.363 9.39794C18.605 9.92594 18.726 10.4814 18.726 11.0644C18.726 11.6584 18.5995 12.2304 18.3465 12.7804C18.0935 13.3304 17.736 13.8089 17.274 14.2159C16.823 14.6119 16.295 14.8869 15.69 15.0409C15.569 15.6679 15.3105 16.2289 14.9145 16.7239C14.5295 17.2299 14.051 17.6259 13.479 17.9119C12.907 18.1979 12.2965 18.3409 11.6475 18.3409ZM7.57201 16.2784C8.12201 16.2784 8.60051 16.1629 9.00751 15.9319L12.1095 14.1499C12.2195 14.0729 12.2745 13.9684 12.2745 13.8364V12.4174L8.28152 14.7109C8.03952 14.8539 7.79751 14.8539 7.55552 14.7109L4.43701 12.9124C4.43701 12.9454 4.43151 12.9839 4.42051 13.0279C4.42051 13.0719 4.42051 13.1379 4.42051 13.2259C4.42051 13.7869 4.55252 14.3039 4.81651 14.7769C5.09152 15.2389 5.47101 15.6019 5.95501 15.8659C6.43901 16.1409 6.97801 16.2784 7.57201 16.2784ZM7.73701 13.5889C7.80301 13.6219 7.86351 13.6384 7.91851 13.6384C7.97351 13.6384 8.02852 13.6219 8.08352 13.5889L9.32101 12.8794L5.34451 10.5694C5.10251 10.4264 4.98151 10.2119 4.98151 9.92594V6.34544C4.43151 6.58744 3.99151 6.96144 3.66151 7.46744C3.33151 7.96244 3.16651 8.51244 3.16651 9.11744C3.16651 9.65644 3.30401 10.1734 3.57901 10.6684C3.85401 11.1634 4.21151 11.5374 4.65151 11.7904L7.73701 13.5889ZM11.6475 17.2519C12.2305 17.2519 12.7585 17.1199 13.2315 16.8559C13.7045 16.5919 14.0785 16.2289 14.3535 15.7669C14.6285 15.3049 14.766 14.7879 14.766 14.2159V10.6519C14.766 10.5199 14.711 10.4209 14.601 10.3549L13.347 9.62894V14.2324C13.347 14.5184 13.226 14.7329 12.984 14.8759L9.86551 16.6744C10.4045 17.0594 10.9985 17.2519 11.6475 17.2519ZM12.2745 11.2129V8.96894L10.41 7.91294L8.52902 8.96894V11.2129L10.41 12.2689L12.2745 11.2129ZM7.45651 5.94944C7.45651 5.66344 7.57752 5.44894 7.81952 5.30594L10.938 3.50744C10.399 3.12244 9.80502 2.92994 9.15602 2.92994C8.57302 2.92994 8.04501 3.06194 7.57201 3.32594C7.09902 3.58994 6.72502 3.95294 6.45002 4.41494C6.18602 4.87694 6.05401 5.39394 6.05401 5.96594V9.51344C6.05401 9.64544 6.10901 9.74994 6.21902 9.82694L7.45651 10.5529V5.94944ZM15.8385 13.8364C16.3885 13.5944 16.823 13.2204 17.142 12.7144C17.472 12.2084 17.637 11.6584 17.637 11.0644C17.637 10.5254 17.4995 10.0084 17.2245 9.51344C16.9495 9.01844 16.592 8.64444 16.152 8.39144L13.0665 6.60944C13.0005 6.56544 12.94 6.54894 12.885 6.55994C12.83 6.55994 12.775 6.57644 12.72 6.60944L11.4825 7.30244L15.4755 9.62894C15.5965 9.69494 15.6845 9.78294 15.7395 9.89294C15.8055 9.99194 15.8385 10.1129 15.8385 10.2559V13.8364ZM12.522 5.45444C12.764 5.30044 13.006 5.30044 13.248 5.45444L16.383 7.28594C16.383 7.20894 16.383 7.10994 16.383 6.98894C16.383 6.46094 16.251 5.96044 15.987 5.48744C15.734 5.00344 15.3655 4.61844 14.8815 4.33244C14.4085 4.04644 13.8585 3.90344 13.2315 3.90344C12.6815 3.90344 12.203 4.01894 11.796 4.24994L8.69402 6.03194C8.58402 6.10894 8.52902 6.21344 8.52902 6.34544V7.76444L12.522 5.45444Z"
        fill="currentColor"
      />
    </svg>
  );
}
