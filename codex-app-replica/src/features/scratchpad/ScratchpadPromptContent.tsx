import { I18N_CONTEXT } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import { PromptLinkContent } from "../../components/PromptLinkContent";
import type { MarkdownLinkContext } from "../../components/markdownPreviewLinks";
import type { AppInfo } from "../../services/apps";
import type { PluginSummary } from "../../services/plugins";
import type { SkillSummary } from "../../services/skills";

type ScratchpadPromptContentProps = {
  apps?: AppInfo[];
  className?: string;
  context: MarkdownLinkContext;
  plugins?: PluginSummary[];
  skills?: SkillSummary[];
  text: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function ScratchpadPromptContent({
  apps = [],
  className,
  context,
  plugins = [],
  skills = [],
  text,
  t,
}: ScratchpadPromptContentProps) {
  const i18nValue = {
    locale: "en-US" as const,
    setLocale: () => {},
    t,
  };

  return (
    <I18N_CONTEXT.Provider value={i18nValue}>
      <PromptLinkContent
        apps={apps}
        className={className}
        context={context}
        plugins={plugins}
        skills={skills}
        text={text}
      />
    </I18N_CONTEXT.Provider>
  );
}
