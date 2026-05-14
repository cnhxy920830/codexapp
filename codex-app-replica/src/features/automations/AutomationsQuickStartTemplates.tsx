import { renderInlineLinkMessage } from "../../i18n/renderInlineLinkMessage";
import type { CronAutomationRecord } from "../../services/automations";
import { resolveAutomationQuickStartIcon } from "./automationQuickStartIcons";
import {
  AUTOMATION_QUICK_START_SECTIONS,
  buildQuickStartAutomationDraft,
  getAutomationQuickStartSectionTemplates,
} from "./automationQuickStartTemplates";
import { SectionedPage, SectionedPageSection } from "./SectionedPage";
import type { TranslateFn } from "./automationsPageUtils";

const LEARN_MORE_URL = "https://developers.openai.com/codex/app/automations";

type Props = {
  baseDraft: CronAutomationRecord;
  className?: string;
  columns?: "one" | "two";
  hideLearnMore?: boolean;
  onSelectAction: (draft: CronAutomationRecord) => void;
  t: TranslateFn;
};

function extractSummary(text: string) {
  const firstNonEmptyLine =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";

  const sentenceMatch = firstNonEmptyLine.match(/^(.+?[.!?])(?:\s|$)/);
  return sentenceMatch?.[1] ?? firstNonEmptyLine;
}

function renderTokenBold(text: string) {
  const parts = text.split(/(\$[a-z0-9-]+)/gi);
  return parts.map((part, index) =>
    /^\$[a-z0-9-]+$/i.test(part) ? <strong key={index}>{part}</strong> : part,
  );
}

export function AutomationsQuickStartTemplates({
  baseDraft,
  className,
  columns = "two",
  hideLearnMore = false,
  onSelectAction,
  t,
}: Props) {
  return (
    <div className={className ?? "mt-2"}>
      {hideLearnMore ? null : (
        <div className="app-text-muted text-[14px] leading-6">
          {renderInlineLinkMessage(
            t("inbox.automations.emptySubtitle.learnMore"),
            LEARN_MORE_URL,
          )}
        </div>
      )}
      <SectionedPage
        ariaLabel={t("inbox.automations.sectionsNav")}
        className="[--sectioned-page-leading-inset:0]"
        contentInnerClassName={hideLearnMore ? "flex flex-col gap-8 pb-2" : "flex flex-col gap-9 pb-2"}
        showNav={false}
      >
        {AUTOMATION_QUICK_START_SECTIONS.map((section) => (
          <SectionedPageSection
            key={section.id}
            id={section.id}
            title={t(section.titleKey)}
          >
            <div
              className={[
                "grid w-full gap-4",
                columns === "two" ? "md:grid-cols-2" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {getAutomationQuickStartSectionTemplates(section).map((template) => {
                const prompt = t(template.promptKey);
                const summary = extractSummary(prompt);
                return (
                  <button
                    key={template.id}
                    type="button"
                    className="group flex w-full flex-col items-start gap-2 rounded-4xl border border-token-border/50 bg-token-input-background/70 px-3 py-3 text-left text-base transition-colors hover:border-token-border hover:bg-token-input-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-token-border"
                    onClick={() =>
                      onSelectAction(
                        buildQuickStartAutomationDraft(template, baseDraft, t),
                      )
                    }
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0"
                      src={resolveAutomationQuickStartIcon(template.iconName)}
                    />
                    <div className="app-title text-[15px] leading-6">
                      {t(template.draftNameKey)}
                    </div>
                    <div className="app-text-muted text-[13px] leading-6">
                      {renderTokenBold(summary)}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionedPageSection>
        ))}
      </SectionedPage>
    </div>
  );
}
