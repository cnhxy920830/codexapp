import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n";
import {
  ChevronDownIcon,
  CloseTabIcon,
  MoreActionsIcon,
} from "./AppShellIcons";
import { ToggleSwitch } from "./ToggleSwitch";
import type { AppInfo, AppTool } from "../services/apps";

type ToolSection = {
  title: "Read" | "Write";
  tools: AppTool[];
};

export function PluginsAppToolsDialog({
  app,
  errorMessage,
  isLoading,
  onOpenAppUrl,
  onOpenChange,
  onSetAppEnabled,
  onTryInChat,
  showEnableToggle = true,
  tools,
  updatingAppId,
}: {
  app: AppInfo | null;
  errorMessage: string | null;
  isLoading: boolean;
  onOpenAppUrl: (url: string | null) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSetAppEnabled: (enabled: boolean) => void | Promise<void>;
  onTryInChat?: () => void;
  showEnableToggle?: boolean;
  tools: AppTool[];
  updatingAppId: string | null;
}) {
  const { t } = useI18n();
  const [collapsedBySection, setCollapsedBySection] = useState<Record<string, boolean>>({});
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);

  useEffect(() => {
    if (app == null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [app, onOpenChange]);

  useEffect(() => {
    setCollapsedBySection({});
    setIsMoreActionsOpen(false);
  }, [app?.id]);

  const toolSections = useMemo(() => buildToolSections(tools), [tools]);
  const isOpen = app != null;

  if (!isOpen || app == null) {
    return null;
  }

  const toggleTooltip = app.isEnabled
    ? t("skills.appsPage.toolsDialog.disableApp")
    : t("skills.appsPage.toolsDialog.enableApp");
  const canTryInChat = app.isAccessible && app.isEnabled;
  const description = app.description ?? t("skills.appsPage.toolsDialog.subtitle");
  const summary = t("skills.appsPage.toolsDialog.summary", {
    actionTypes: toolSections.map((section) => formatSectionSummary(section)).join(", "),
    appName: app.name,
    totalActions: tools.length,
  });

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.32)] p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="app-card flex max-h-[min(80vh,760px)] w-full max-w-[820px] flex-col overflow-hidden rounded-[20px] px-6 py-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-shell-border)] text-[var(--app-shell-subtle)]">
              <AppToolsIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-[18px] font-medium">{app.name}</div>
                {app.isAccessible && !app.isEnabled ? (
                  <span className="rounded-full border border-[var(--app-shell-border)] bg-transparent px-2 py-0.5 text-[11px] font-medium text-[var(--app-shell-subtle)]">
                    {t("skills.appsPage.toolsDialog.disabledBadge")}
                  </span>
                ) : null}
                <div className="shrink-0 text-[13px] text-[var(--app-shell-subtle)]">App</div>
              </div>
              <div className="app-text-muted mt-2 text-[14px] leading-6">{description}</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showEnableToggle && app.isAccessible ? (
              <div title={toggleTooltip}>
                <ToggleSwitch
                  ariaLabel={toggleTooltip}
                  checked={app.isEnabled}
                  disabled={updatingAppId === app.id}
                  onChange={(enabled) => void onSetAppEnabled(enabled)}
                />
              </div>
            ) : null}

            <div className="relative">
              <button
                type="button"
                aria-label={t("skills.appsPage.toolsDialog.moreActions")}
                onClick={() => setIsMoreActionsOpen((open) => !open)}
                className="app-control-weak flex size-8 items-center justify-center rounded-full"
              >
                <MoreActionsIcon className="h-4 w-4" />
              </button>
              {isMoreActionsOpen ? (
                <div className="app-card absolute top-[calc(100%+8px)] right-0 z-10 w-[210px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <button
                    type="button"
                    disabled={app.installUrl == null}
                    onClick={() => {
                      setIsMoreActionsOpen(false);
                      void onOpenAppUrl(app.installUrl);
                    }}
                    className="app-nav-item-idle w-full rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-50"
                  >
                    {t("skills.appsPage.toolsDialog.open")}
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              aria-label={t("codex.alert.closeAriaLabel")}
              onClick={() => onOpenChange(false)}
              className="app-control-weak flex size-8 items-center justify-center rounded-full"
            >
              <CloseTabIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="app-text-muted mt-4 text-[13px] leading-6">{summary}</div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]">
          {isLoading ? (
            <CenteredDialogState title={t("skills.appsPage.toolsDialog.loading")} />
          ) : errorMessage ? (
            <CenteredDialogState
              description={errorMessage}
              title={t("skills.appsPage.toolsDialog.error")}
            />
          ) : tools.length === 0 ? (
            <CenteredDialogState title={t("skills.appsPage.toolsDialog.empty")} />
          ) : (
            <div className="h-full min-h-0 overflow-y-auto">
              {toolSections.map((section) => {
                const isCollapsed = collapsedBySection[section.title] === true;

                return (
                  <div
                    key={section.title}
                    className="border-b border-[var(--app-shell-border)] last:border-b-0"
                  >
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsedBySection((current) => ({
                          ...current,
                          [section.title]: !isCollapsed,
                        }))
                      }
                      className="sticky top-0 flex w-full items-center justify-between bg-[var(--app-shell-main-surface)] px-3 py-2.5 text-left text-[14px]"
                    >
                      <span>
                        {section.title}
                        <span className="ml-2 text-[var(--app-shell-subtle)]">
                          {section.tools.length}
                        </span>
                      </span>
                      <ChevronDownIcon
                        className={[
                          "h-3.5 w-3.5 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
                          isCollapsed ? "-rotate-90" : "",
                        ].join(" ")}
                      />
                    </button>

                    {isCollapsed ? null : (
                      <div className="divide-y divide-[var(--app-shell-border)]">
                        {section.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-x-3 px-3 py-2.5"
                          >
                            <div className="min-w-0 truncate text-[14px]" title={tool.name}>
                              {tool.name}
                            </div>
                            <div className="app-text-muted whitespace-pre-wrap text-[13px] leading-6">
                              {tool.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <div title={canTryInChat ? undefined : t("skills.appsPage.toolsDialog.tryInChatDisabled")}>
            <button
              type="button"
              disabled={!canTryInChat}
              onClick={() => {
                if (!canTryInChat) {
                  return;
                }
                onTryInChat?.();
                onOpenChange(false);
              }}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {t("skills.appsPage.toolsDialog.tryInChat")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CenteredDialogState({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center px-6 text-center">
      <div>
        <div className="app-text-muted text-[13px]">{title}</div>
        {description ? (
          <div className="app-text-muted mt-2 text-[12px] leading-5">{description}</div>
        ) : null}
      </div>
    </div>
  );
}

function buildToolSections(tools: AppTool[]): ToolSection[] {
  const readTools = tools.filter((tool) => tool.accessBadges.includes("READ"));
  const writeTools = tools.filter((tool) => !tool.accessBadges.includes("READ"));

  return [
    { title: "Write", tools: writeTools },
    { title: "Read", tools: readTools },
  ].filter((section) => section.tools.length > 0) as ToolSection[];
}

function formatSectionSummary(section: ToolSection) {
  return `${section.tools.length} ${section.title.toLowerCase()}`;
}

function AppToolsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7.45996 14.375C7.45996 13.3616 6.63844 12.54 5.625 12.54C4.61156 12.54 3.79004 13.3616 3.79004 14.375C3.79004 15.3884 4.61156 16.21 5.625 16.21C6.63844 16.21 7.45996 15.3884 7.45996 14.375ZM16.21 14.375C16.21 13.3616 15.3884 12.54 14.375 12.54C13.3616 12.54 12.54 13.3616 12.54 14.375C12.54 15.3884 13.3616 16.21 14.375 16.21C15.3884 16.21 16.21 15.3884 16.21 14.375ZM7.45996 5.625C7.45996 4.61156 6.63844 3.79004 5.625 3.79004C4.61156 3.79004 3.79004 4.61156 3.79004 5.625C3.79004 6.63844 4.61156 7.45996 5.625 7.45996C6.63844 7.45996 7.45996 6.63844 7.45996 5.625ZM16.21 5.625C16.21 4.61156 15.3884 3.79004 14.375 3.79004C13.3616 3.79004 12.54 4.61156 12.54 5.625C12.54 6.63844 13.3616 7.45996 14.375 7.45996C15.3884 7.45996 16.21 6.63844 16.21 5.625ZM17.54 14.375C17.54 16.123 16.123 17.54 14.375 17.54C12.627 17.54 11.21 16.123 11.21 14.375C11.21 12.627 12.627 11.21 14.375 11.21C16.123 11.21 17.54 12.627 17.54 14.375ZM8.79004 5.625C8.79004 7.37298 7.37298 8.79004 5.625 8.79004C3.87702 8.79004 2.45996 7.37298 2.45996 5.625C2.45996 3.87702 3.87702 2.45996 5.625 2.45996C7.37298 2.45996 8.79004 3.87702 8.79004 5.625ZM17.54 5.625C17.54 7.37298 16.123 8.79004 14.375 8.79004C13.7416 8.79004 13.153 8.60173 12.6582 8.28125L8.28125 12.6582C8.60173 13.153 8.79004 13.7416 8.79004 14.375C8.79004 16.123 7.37298 17.54 5.625 17.54C3.87702 17.54 2.45996 16.123 2.45996 14.375C2.45996 12.627 3.87702 11.21 5.625 11.21C6.25794 11.21 6.84623 11.3977 7.34082 11.7178L11.7178 7.34082C11.3977 6.84623 11.21 6.25794 11.21 5.625C11.21 3.87702 12.627 2.45996 14.375 2.45996C16.123 2.45996 17.54 3.87702 17.54 5.625Z"
        fill="currentColor"
      />
    </svg>
  );
}
