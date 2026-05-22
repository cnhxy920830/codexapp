import { useMemo, useState } from "react";
import { WarningIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { Tooltip } from "../../components/Tooltip";
import { useI18n } from "../../i18n/i18n";
import { openInBrowser } from "../../services/hostFiles";
import type {
  ConnectorPersonalizationMode,
} from "../../services/appConnect";
import type { PluginDetail } from "../../services/plugins";
import type {
  BrowserExtensionState,
  PluginConnectorDisclosure,
  PluginInstallBlockedReason,
  RequiredAppInstallState,
} from "./pluginInstallHelpers";
import type {
  PluginInstallSessionState,
} from "./pluginInstallSession";
import { OpenAiBlossomIcon } from "../auth/OpenAiBlossomIcon";

type PluginInstallModalProps = {
  appPersonalizationModes: Record<string, ConnectorPersonalizationMode>;
  connectorDisclosures: PluginConnectorDisclosure[] | null;
  isInstalling: boolean;
  isLoadingDisclosure: boolean;
  onAppPersonalizationModeChange: (
    appId: string,
    mode: ConnectorPersonalizationMode,
  ) => void;
  onClose: () => void;
  onConnectRequiredApp: (appId: string) => void;
  onInstall: () => void;
  session: PluginInstallSessionState;
};

export function PluginInstallModal({
  appPersonalizationModes,
  connectorDisclosures,
  isInstalling,
  isLoadingDisclosure,
  onAppPersonalizationModeChange,
  onClose,
  onConnectRequiredApp,
  onInstall,
  session,
}: PluginInstallModalProps) {
  const { t } = useI18n();

  if (session.kind === "closed") {
    return null;
  }

  const pluginName =
    session.plugin.summary.interface?.displayName ?? session.plugin.summary.name;
  const isOnInstallDisclosurePhase =
    session.kind === "details" &&
    session.plugin.summary.authPolicy === "ON_INSTALL" &&
    session.plugin.apps.length > 0;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.32)] px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isInstalling) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        role="dialog"
        aria-label={
          session.kind === "details"
            ? t("plugins.installModal.title", { pluginName })
            : t("plugins.installModal.finishSetup.title", { pluginName })
        }
        className="app-card flex max-h-[calc(100vh-4rem)] w-full max-w-[640px] flex-col gap-6 overflow-hidden rounded-[18px] px-6 pb-6 pt-8 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
      >
        <Header
          phase={session.kind === "needsApps" ? "needsApps" : "details"}
          plugin={session.plugin}
        />

        <div className="min-h-0 overflow-y-auto">
          {session.kind === "details" ? (
            <div className="rounded-[16px] border border-token-border px-4 py-2">
              {!isOnInstallDisclosurePhase ? (
                <>
                  <PluginMetadata plugin={session.plugin} />
                  <AboutSection plugin={session.plugin} />
                  <IncludesSection
                    browserExtensions={session.includedBrowserExtensions}
                    plugin={session.plugin}
                  />
                  <CapabilitiesSection plugin={session.plugin} />
                </>
              ) : null}
              {isOnInstallDisclosurePhase ? (
                <DisclosureSection
                  appPersonalizationModes={appPersonalizationModes}
                  connectorDisclosures={connectorDisclosures}
                  isLoadingDisclosure={isLoadingDisclosure}
                  onAppPersonalizationModeChange={onAppPersonalizationModeChange}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <RequiredAppsSection
                onConnectRequiredApp={onConnectRequiredApp}
                requiredApps={session.requiredApps}
              />
              <RequiredBrowserExtensionsSection
                requiredBrowserExtensions={session.requiredBrowserExtensions}
              />
            </div>
          )}
        </div>

        {session.kind === "details" ? (
          <div className="flex justify-end">
            <InstallButton
              blockedReason={session.blockedReason}
              isDisabled={isLoadingDisclosure && isOnInstallDisclosurePhase}
              isInstalling={isInstalling}
              onInstall={onInstall}
              pluginName={pluginName}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Header({
  phase,
  plugin,
}: {
  phase: "details" | "needsApps";
  plugin: PluginDetail;
}) {
  const { t } = useI18n();
  const pluginName =
    plugin.summary.interface?.displayName ?? plugin.summary.name;
  const developerName = plugin.summary.interface?.developerName?.trim() ?? null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black text-white shadow-sm">
          <OpenAiBlossomIcon className="h-12 w-12" />
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-token-border" />
          <span className="size-1.5 rounded-full bg-token-border" />
          <span className="size-1.5 rounded-full bg-token-border" />
        </span>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-token-border bg-token-bg-primary shadow-sm">
          <PluginInstallLogo
            pluginName={pluginName}
            logoUrl={plugin.summary.interface?.logoUrl ?? null}
          />
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="text-[22px] font-medium tracking-[-0.03em] text-token-foreground">
          {phase === "details"
            ? t("plugins.installModal.title", { pluginName })
            : t("plugins.installModal.finishSetup.title", { pluginName })}
        </div>
        {developerName ? (
          <div className="text-[14px] text-token-text-secondary">
            {t("plugins.installModal.developedBy", { developerName })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PluginMetadata({ plugin }: { plugin: PluginDetail }) {
  const marketplaceName = plugin.marketplaceName.trim();
  const developerName = plugin.summary.interface?.developerName?.trim() ?? null;
  const category = plugin.summary.interface?.category?.trim() ?? null;
  const pluginName =
    plugin.summary.interface?.displayName ?? plugin.summary.name;

  if (developerName == null && category == null && marketplaceName.length === 0) {
    return null;
  }

  return (
    <SectionBlock>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium text-token-text-primary">
          {pluginName}
        </div>
        {marketplaceName.length > 0 ? (
          <span className="rounded-md border border-token-border px-1.5 py-0.5 text-xs font-medium text-token-text-secondary">
            {marketplaceName}
          </span>
        ) : null}
      </div>
      {developerName || category ? (
        <div className="flex flex-col gap-1 text-sm text-token-text-secondary">
          {developerName ? (
            <div>{`By ${developerName}`}</div>
          ) : null}
          {category ? <div>{`Category: ${category}`}</div> : null}
        </div>
      ) : null}
    </SectionBlock>
  );
}

function AboutSection({ plugin }: { plugin: PluginDetail }) {
  const { t } = useI18n();
  const description =
    plugin.summary.interface?.longDescription?.trim() ||
    plugin.summary.interface?.shortDescription?.trim() ||
    plugin.description?.trim() ||
    null;

  if (description == null) {
    return null;
  }

  return (
    <SectionBlock>
      <div className="text-sm font-medium text-token-text-primary">
        {t("plugins.installModal.about")}
      </div>
      <div className="max-h-40 overflow-y-auto pr-1 text-sm text-token-text-secondary">
        {description}
      </div>
    </SectionBlock>
  );
}

function IncludesSection({
  browserExtensions,
  plugin,
}: {
  browserExtensions: BrowserExtensionState[];
  plugin: PluginDetail;
}) {
  const { t } = useI18n();
  const groups = [
    {
      id: "apps",
      title: t("plugins.installModal.includes.apps"),
      items: plugin.apps.map((app) => app.name),
    },
    {
      id: "browser-extensions",
      title: t("plugins.installModal.includes.browserExtensions"),
      items: browserExtensions.map((extension) => extension.name),
    },
    {
      id: "skills",
      title: t("plugins.installModal.includes.skills"),
      items: plugin.skills.map((skill) => skill.name),
    },
    {
      id: "mcp-servers",
      title: t("plugins.installModal.includes.mcpServers"),
      items: plugin.mcpServers,
    },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <SectionBlock>
      <div className="text-sm font-medium text-token-text-primary">
        {t("plugins.installModal.includes")}
      </div>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-[14px] border border-token-border bg-token-bg-primary/40 px-4 py-3"
          >
            <div className="text-[13px] font-medium text-token-foreground">
              {group.title}
            </div>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => (
                <div
                  key={item}
                  className="text-[12px] leading-5 text-token-text-secondary"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
}

function CapabilitiesSection({ plugin }: { plugin: PluginDetail }) {
  const { t } = useI18n();
  const capabilities = plugin.summary.interface?.capabilities ?? [];
  if (capabilities.length === 0) {
    return null;
  }

  return (
    <SectionBlock>
      <div className="text-sm font-medium text-token-text-primary">
        {t("plugins.installModal.capabilities")}
      </div>
      <div className="flex flex-wrap gap-2">
        {capabilities.map((capability) => (
          <span
            key={capability}
            className="rounded-md border border-token-border bg-transparent px-1.5 py-0.5 text-xs font-medium text-token-text-secondary"
          >
            {capability}
          </span>
        ))}
      </div>
    </SectionBlock>
  );
}

function DisclosureSection({
  appPersonalizationModes,
  connectorDisclosures,
  isLoadingDisclosure,
  onAppPersonalizationModeChange,
}: {
  appPersonalizationModes: Record<string, ConnectorPersonalizationMode>;
  connectorDisclosures: PluginConnectorDisclosure[] | null;
  isLoadingDisclosure: boolean;
  onAppPersonalizationModeChange: (
    appId: string,
    mode: ConnectorPersonalizationMode,
  ) => void;
}) {
  const blurbs = useMemo(() => {
    if (connectorDisclosures == null) {
      return [];
    }

    const seen = new Set<string>();
    return connectorDisclosures.flatMap((disclosure) =>
      disclosure.blurbs.filter((blurb) => {
        const key = `${blurb.title}\u0000${blurb.description}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      }),
    );
  }, [connectorDisclosures]);

  const toggles = connectorDisclosures?.flatMap((disclosure) =>
    disclosure.personalizationToggle == null
      ? []
      : [disclosure.personalizationToggle],
  ) ?? [];

  if (isLoadingDisclosure) {
    return <DisclosureSkeleton />;
  }

  return (
    <div className="text-sm text-token-text-secondary">
      {toggles.map((toggle) => (
        <div
          key={toggle.appId}
          className="flex items-start justify-between gap-4 border-b border-token-border py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-token-text-primary">
              {toggle.blurb.title}
            </div>
            <div>{renderDisclosureText(toggle.blurb.description)}</div>
          </div>
          <ToggleSwitch
            ariaLabel={toggle.appName}
            checked={
              appPersonalizationModes[toggle.appId] === "PERSONALIZE_ALWAYS"
            }
            disabled={false}
            onChange={(checked) => {
              onAppPersonalizationModeChange(
                toggle.appId,
                checked ? "PERSONALIZE_ALWAYS" : "NO_PERSONALIZATION",
              );
            }}
          />
        </div>
      ))}

      {blurbs.map((blurb, index) => (
        <div
          key={`${blurb.title}-${index}`}
          className={[
            "flex flex-col gap-1 py-3",
            toggles.length > 0 || index > 0 ? "border-b border-token-border" : "",
            index === blurbs.length - 1 ? "last:border-b-0" : "",
          ].join(" ")}
        >
          <div className="font-medium text-token-text-primary">{blurb.title}</div>
          <div>{renderDisclosureText(blurb.description)}</div>
        </div>
      ))}
    </div>
  );
}

function DisclosureSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 border-b border-token-border py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div className="h-3 w-36 rounded bg-token-border" />
          <div className="h-2.5 w-full rounded bg-token-border" />
          <div className="h-2.5 w-4/5 rounded bg-token-border" />
        </div>
      ))}
    </div>
  );
}

function RequiredAppsSection({
  onConnectRequiredApp,
  requiredApps,
}: {
  onConnectRequiredApp: (appId: string) => void;
  requiredApps: RequiredAppInstallState[];
}) {
  const { t } = useI18n();

  if (requiredApps.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="pl-1 text-[15px] font-medium text-token-foreground">
        {t("plugins.installModal.requiredApps")}
      </div>
      <div className="grid gap-3">
        {requiredApps.map((app) => (
          <div
            key={app.appId}
            className="flex items-center justify-between gap-3 rounded-[14px] border border-token-border bg-token-bg-primary/40 px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <AppLogo
                label={app.name}
                logoUrl={app.logoUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-token-foreground">
                  {app.name}
                </div>
                {app.description ? (
                  <div className="mt-1 text-[12px] leading-5 text-token-text-secondary">
                    {app.description}
                  </div>
                ) : null}
              </div>
            </div>
            <Button
              color="secondary"
              size="toolbar"
              disabled={
                app.status === "connected" ||
                app.status === "launching" ||
                app.status === "waitingForCallback" ||
                app.installUrl == null
              }
              onClick={() => onConnectRequiredApp(app.appId)}
            >
              {app.status === "connected"
                ? t("plugins.installModal.requiredApps.connected")
                : app.status === "launching" ||
                    app.status === "waitingForCallback"
                  ? t("plugins.installModal.requiredApps.connecting")
                  : t("plugins.installModal.requiredApps.connect")}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function RequiredBrowserExtensionsSection({
  requiredBrowserExtensions,
}: {
  requiredBrowserExtensions: Extract<PluginInstallSessionState, { kind: "needsApps" }>["requiredBrowserExtensions"];
}) {
  const { t } = useI18n();

  if (requiredBrowserExtensions.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="pl-1 text-[15px] font-medium text-token-foreground">
        {t("plugins.installModal.requiredBrowserExtensions")}
      </div>
      <div className="grid gap-3">
        {requiredBrowserExtensions.map((extension) => (
          <div
            key={extension.id}
            className="flex items-center justify-between gap-3 rounded-[14px] border border-token-border bg-token-bg-primary/40 px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <AppLogo label={extension.name} logoUrl={extension.iconUrl} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-token-foreground">
                  {extension.name}
                </div>
                <div className="mt-1 text-[12px] leading-5 text-token-text-secondary">
                  {t("plugins.installModal.browserExtension.description")}
                </div>
              </div>
            </div>
            <Button
              color="secondary"
              size="toolbar"
              onClick={() => {
                void openInBrowser(extension.installUrl);
              }}
            >
              {t("plugins.installModal.openBrowserExtension")}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function InstallButton({
  blockedReason,
  isDisabled,
  isInstalling,
  onInstall,
  pluginName,
}: {
  blockedReason: PluginInstallBlockedReason | null;
  isDisabled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
  pluginName: string;
}) {
  const { t } = useI18n();
  const action = (
    <Button
      color="primary"
      disabled={blockedReason != null || isDisabled}
      loading={isInstalling}
      size="toolbar"
      className="w-full justify-center"
      onClick={onInstall}
    >
      {blockedReason === "disabled-by-admin" ? (
        <WarningIcon className="h-4 w-4" />
      ) : null}
      {isInstalling
        ? t("plugins.installModal.installing", { pluginName })
        : t("plugins.installModal.install", { pluginName })}
    </Button>
  );

  if (blockedReason === "connector-unavailable") {
    return (
      <Tooltip tooltipContent={t("plugins.install.connectorUnavailable")}>
        <div className="flex w-full">{action}</div>
      </Tooltip>
    );
  }
  if (blockedReason === "disabled-by-admin") {
    return (
      <Tooltip tooltipContent={t("plugins.install.disabledByAdmin")}>
        <div className="flex w-full">{action}</div>
      </Tooltip>
    );
  }
  return action;
}

function SectionBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-token-border py-3 last:border-b-0">
      {children}
    </div>
  );
}

function PluginInstallLogo({
  logoUrl,
  pluginName,
}: {
  logoUrl: string | null;
  pluginName: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  if (logoUrl == null || hasImageError) {
    return (
      <span className="text-[16px] font-medium text-token-foreground">
        {pluginName.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      alt={pluginName}
      className="h-full w-full object-contain"
      src={logoUrl}
      onError={() => setHasImageError(true)}
    />
  );
}

function AppLogo({
  label,
  logoUrl,
}: {
  label: string;
  logoUrl: string | null;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  if (logoUrl == null || hasImageError) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-token-border bg-token-bg-primary text-xs font-medium text-token-foreground shadow-sm">
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-token-border bg-token-bg-primary shadow-sm">
      <img
        alt={label}
        className="h-full w-full object-contain"
        src={logoUrl}
        onError={() => setHasImageError(true)}
      />
    </span>
  );
}

function renderDisclosureText(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;

  for (let match = pattern.exec(text); match != null; match = pattern.exec(text)) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, label, url] = match;
    const normalizedUrl = url.trim();
    if (normalizedUrl.length === 0) {
      parts.push(label);
    } else {
      parts.push(
        <a
          key={`${normalizedUrl}-${match.index}`}
          href={normalizedUrl}
          className="underline underline-offset-2 hover:no-underline"
          onClick={(event) => {
            event.preventDefault();
            void openInBrowser(normalizedUrl);
          }}
        >
          {label}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    return text;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts;
}
