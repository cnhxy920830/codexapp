import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { BrowserTabIcon, CheckIcon, CopyPathIcon, FolderIcon, WorkspaceFileIcon } from "./AppShellIcons";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { decodeFileUrlPath, looksLikeFileReference, parseFileReference } from "../lib/fileReference";
import { openFile, openInBrowser } from "../services/hostFiles";
import type { OpenInTargetsResponse, OpenTargetItem, OpenTargetMode } from "../services/openTargets";
import type { MarkdownFileLinkReference } from "./markdownLinkTypes";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

export type MarkdownLinkContext = {
  canFileLinkOpenInSidePanel?: ((fileReference: MarkdownFileLinkReference) => boolean) | null;
  cwd?: string | null;
  hostId?: string | null;
  onExternalLinkOpenInBrowser?: ((href: string) => void) | null;
  onFileLinkOpen?: ((fileReference: MarkdownFileLinkReference) => void) | null;
  onFileLinkOpenInBrowser?: ((fileReference: MarkdownFileLinkReference) => void) | null;
};

type FileReferenceLink = MarkdownFileLinkReference;

type MenuPosition = {
  x: number;
  y: number;
};

type RuntimeMenuItem =
  | {
      id: string;
      kind: "action";
      label: string;
      checked?: boolean;
      icon?: ReactNode;
      onSelect: () => void | Promise<void>;
    }
  | {
      id: string;
      kind: "separator";
    }
  | {
      id: string;
      kind: "submenu";
      label: string;
      icon?: ReactNode;
      items: RuntimeMenuItem[];
    };

export type MenuSpec =
  | {
      id: string;
      kind: "action";
      key: "copy-link" | "copy-path" | "open-external-browser" | "open-primary" | "reveal-path";
      label: string;
      checked?: boolean;
      target?: OpenTargetItem;
    }
  | {
      id: string;
      kind: "separator";
    }
  | {
      id: string;
      kind: "submenu";
      label: string;
      items: Array<{
        id: string;
        label: string;
        checked?: boolean;
        target: OpenTargetItem;
      }>;
    };

export function MarkdownOwnedLink({
  children,
  className,
  context,
  href,
  title,
}: {
  children: ReactNode;
  className: string;
  context: MarkdownLinkContext;
  href: string;
  title: string;
}) {
  const { t } = useI18n();
  const [menuState, setMenuState] = useState<{
    items: RuntimeMenuItem[];
    position: MenuPosition;
  } | null>(null);

  const closeMenu = () => {
    setMenuState(null);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        title={title}
        onClick={(event) => {
          event.preventDefault();
          void activateMarkdownHref({
            context,
            href,
            modifiedClick: isModifiedActivation(event),
          });
        }}
        onContextMenu={(event) => {
          const position = {
            x: event.clientX,
            y: event.clientY,
          };
          event.preventDefault();
          void buildMarkdownHrefContextMenuItems({
            context,
            href,
            t,
          }).then((items) => {
            if (items.length === 0) {
              return;
            }

            setMenuState({
              items,
              position,
            });
          });
        }}
      >
        {children}
      </button>
      {menuState ? <MarkdownLinkContextMenu items={menuState.items} position={menuState.position} onClose={closeMenu} /> : null}
    </>
  );
}

export function useMarkdownHtmlLinkOwner(context: MarkdownLinkContext) {
  const { t } = useI18n();
  const [menuState, setMenuState] = useState<{
    items: RuntimeMenuItem[];
    position: MenuPosition;
  } | null>(null);

  return {
    menu:
      menuState == null ? null : (
        <MarkdownLinkContextMenu items={menuState.items} position={menuState.position} onClose={() => setMenuState(null)} />
      ),
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      const href = getHtmlAnchorHref(event.target);
      if (href == null) {
        return;
      }

      event.preventDefault();
      void activateMarkdownHref({
        context,
        href,
        modifiedClick: isModifiedActivation(event),
      });
    },
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      const href = getHtmlAnchorHref(event.target);
      if (href == null) {
        return;
      }

      const position = {
        x: event.clientX,
        y: event.clientY,
      };
      event.preventDefault();
      void buildMarkdownHrefContextMenuItems({
        context,
        href,
        t,
      }).then((items) => {
        if (items.length === 0) {
          return;
        }

        setMenuState({
          items,
          position,
        });
      });
    },
  };
}

export function filterOpenTargets({
  availableTargets,
  includeHiddenTargets = false,
  mode = "editor",
  targets,
}: {
  availableTargets: string[];
  includeHiddenTargets?: boolean;
  mode?: OpenTargetMode;
  targets: OpenTargetItem[];
}) {
  if (mode === "native") {
    return targets.filter((target) => target.target === "systemDefault" || target.target === "fileManager");
  }

  const availableTargetSet = new Set(availableTargets);
  return targets.filter((target) => availableTargetSet.has(target.target) && (includeHiddenTargets || !target.hidden));
}

export function resolvePreferredOpenTarget({
  availableTargets,
  includeHiddenTargets = true,
  mode = "editor",
  preferredTarget,
  targets,
}: {
  availableTargets: string[];
  includeHiddenTargets?: boolean;
  mode?: OpenTargetMode;
  preferredTarget: string | null;
  targets: OpenTargetItem[];
}) {
  const filteredTargets = filterOpenTargets({
    targets,
    availableTargets,
    includeHiddenTargets,
    mode,
  });
  if (filteredTargets.length === 0) {
    return null;
  }

  if (preferredTarget != null) {
    return filteredTargets.find((target) => target.target === preferredTarget) ?? filteredTargets[0] ?? null;
  }

  return filteredTargets[0] ?? null;
}

export function buildExternalLinkMenuSpecs({
  t,
}: {
  t: Translate;
}): MenuSpec[] {
  return [
    {
      id: "open-in-codex-browser",
      kind: "action",
      key: "open-primary",
      label: t("markdown.externalLink.openInBrowser"),
    },
    {
      id: "open-in-external-browser",
      kind: "action",
      key: "open-external-browser",
      label: t("markdown.externalLink.openInExternalBrowser"),
    },
    {
      id: "external-link-separator",
      kind: "separator",
    },
    {
      id: "copy-link",
      kind: "action",
      key: "copy-link",
      label: t("markdown.externalLink.copyLink"),
    },
  ];
}

export function buildFileLinkMenuSpecs({
  mode,
  preferBrowserPrimaryAction = false,
  preferSidePanelPrimaryAction = false,
  preferredTarget,
  revealLabelKey,
  revealTargetSupported,
  t,
  targets,
}: {
  mode: OpenTargetMode;
  preferBrowserPrimaryAction?: boolean;
  preferSidePanelPrimaryAction?: boolean;
  preferredTarget: OpenTargetItem | null;
  revealLabelKey: MessageKey;
  revealTargetSupported: boolean;
  t: Translate;
  targets: OpenTargetItem[];
}): MenuSpec[] {
  const items: MenuSpec[] = [];

  if (preferSidePanelPrimaryAction || preferBrowserPrimaryAction || preferredTarget != null) {
    const useViewFileLabel =
      preferSidePanelPrimaryAction || (mode === "native" && preferredTarget?.kind === "systemDefault");
    items.push({
      id: "open-primary",
      kind: "action",
      key: "open-primary",
      label: preferBrowserPrimaryAction && !preferSidePanelPrimaryAction
        ? t("markdown.fileReference.viewInCodexBrowser")
        : useViewFileLabel
          ? t("markdown.fileReference.viewFile")
        : t("markdown.fileReference.openInTarget", {
            target: preferredTarget?.label ?? "",
          }),
      target: preferredTarget ?? undefined,
    });
  }

  if (targets.length > 0) {
    items.push({
      id: "open-with",
      kind: "submenu",
      label: t("markdown.fileReference.openWith"),
      items: targets.map((target) => ({
        id: `open-with:${target.id}`,
        label: t("markdown.fileReference.openWithTarget", {
          target: target.label,
        }),
        checked: preferredTarget?.target === target.target,
        target,
      })),
    });
  }

  if (items.length > 0) {
    items.push({
      id: "open-target-separator",
      kind: "separator",
    });
  }

  items.push({
    id: "copy-path",
    kind: "action",
    key: "copy-path",
    label: t("markdown.fileReference.copyPath"),
  });

  if (revealTargetSupported) {
    items.push({
      id: "reveal-path",
      kind: "action",
      key: "reveal-path",
      label: t(revealLabelKey),
    });
  }

  return items;
}

export async function activateMarkdownHref({
  context,
  href,
  modifiedClick = false,
  loadTargets,
}: {
  context: MarkdownLinkContext;
  href: string;
  modifiedClick?: boolean;
  loadTargets?: () => Promise<OpenInTargetsResponse | null>;
}) {
  const normalizedHref = href.trim();
  if (normalizedHref.length === 0 || !isSafeMarkdownUrl(normalizedHref)) {
    return;
  }

  const fileReference = resolveMarkdownFileReference(normalizedHref);
  if (fileReference != null) {
    if (!modifiedClick && shouldOpenMarkdownFileInSidePanel(context, fileReference)) {
      openMarkdownFileInSidePanel(context, fileReference);
      return;
    }

    if (!modifiedClick && shouldOpenMarkdownFileInBrowser(context, fileReference)) {
      openMarkdownFileInBrowser(context, fileReference);
      return;
    }

    if (modifiedClick) {
      const targetsResponse =
        loadTargets == null ? await readMarkdownOpenTargets({ context, path: fileReference.path }) : await loadTargets();
      const preferredTarget =
        targetsResponse == null
          ? null
          : resolvePreferredOpenTarget({
              preferredTarget: targetsResponse.preferredTarget,
              targets: targetsResponse.targets,
              availableTargets: targetsResponse.availableTargets,
              mode: targetsResponse.mode,
            });
      await openMarkdownFile({
        context,
        fileReference,
        target: preferredTarget?.target ?? null,
      });
      return;
    }

    await openMarkdownFile({
      context,
      fileReference,
      target: null,
    });
    return;
  }

  const browserHref = normalizeMarkdownBrowserHref(normalizedHref);
  if (browserHref == null) {
    return;
  }

  if (!modifiedClick && context.onExternalLinkOpenInBrowser != null) {
    context.onExternalLinkOpenInBrowser(browserHref);
    return;
  }

  await openInBrowser(browserHref);
}

export async function buildMarkdownHrefContextMenuItems({
  context,
  href,
  loadTargets,
  t,
}: {
  context: MarkdownLinkContext;
  href: string;
  loadTargets?: () => Promise<OpenInTargetsResponse | null>;
  t: Translate;
}): Promise<RuntimeMenuItem[]> {
  const normalizedHref = href.trim();
  if (normalizedHref.length === 0 || !isSafeMarkdownUrl(normalizedHref)) {
    return [];
  }

  const fileReference = resolveMarkdownFileReference(normalizedHref);
  if (fileReference != null) {
    const targetsResponse =
      loadTargets == null ? await readMarkdownOpenTargets({ context, path: fileReference.path }) : await loadTargets();
    return buildRuntimeFileLinkMenuItems({
      context,
      fileReference,
      targetsResponse,
      t,
    });
  }

  const browserHref = normalizeMarkdownBrowserHref(normalizedHref);
  if (browserHref == null) {
    return [];
  }

  return [
    {
      id: "open-in-codex-browser",
      kind: "action",
      label: t("markdown.externalLink.openInBrowser"),
      icon: <BrowserTabIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
      onSelect: () => {
        if (context.onExternalLinkOpenInBrowser != null) {
          context.onExternalLinkOpenInBrowser(browserHref);
          return;
        }

        return openInBrowser(browserHref);
      },
    },
    {
      id: "open-in-external-browser",
      kind: "action",
      label: t("markdown.externalLink.openInExternalBrowser"),
      icon: <BrowserTabIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
      onSelect: () => openInBrowser(browserHref),
    },
    {
      id: "external-link-separator",
      kind: "separator",
    },
    {
      id: "copy-link",
      kind: "action",
      label: t("markdown.externalLink.copyLink"),
      icon: <CopyPathIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
      onSelect: () => {
        void writeClipboardText(browserHref);
      },
    },
  ];
}

export function resolveMarkdownFileReference(href: string): FileReferenceLink | null {
  if (href.toLowerCase().startsWith("file://")) {
    return {
      column: null,
      line: null,
      path: decodeFileUrlPath(href),
    };
  }

  if (!looksLikeFileReference(href)) {
    return null;
  }

  return parseFileReference(href);
}

export function normalizeMarkdownBrowserHref(href: string) {
  if (/^www\./i.test(href)) {
    return `https://${href}`;
  }

  if (/^[a-z][a-z\d+\-.]*:/i.test(href)) {
    return href;
  }

  return null;
}

export function isSafeMarkdownUrl(url: string) {
  return !/^(javascript:|vbscript:|data:)/i.test(url);
}

function MarkdownLinkContextMenu({
  items,
  onClose,
  position,
}: {
  items: RuntimeMenuItem[];
  onClose: () => void;
  position: MenuPosition;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleContextMenu = (event: globalThis.MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="app-card fixed z-30 min-w-[196px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
      style={getSafeMenuPosition(position)}
    >
      <MarkdownLinkContextMenuList items={items} onClose={onClose} />
    </div>
  );
}

function MarkdownLinkContextMenuList({
  items,
  onClose,
}: {
  items: RuntimeMenuItem[];
  onClose: () => void;
}) {
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        if (item.kind === "separator") {
          return <div key={item.id} className="my-1 h-px bg-[var(--app-shell-border)]" />;
        }

        if (item.kind === "submenu") {
          const isActive = activeSubmenuId === item.id;
          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => {
                setActiveSubmenuId(item.id);
              }}
              onMouseLeave={() => {
                setActiveSubmenuId((current) => (current === item.id ? null : current));
              }}
            >
              <button
                type="button"
                className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
                onFocus={() => {
                  setActiveSubmenuId(item.id);
                }}
              >
                {item.icon ?? <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-[var(--app-shell-muted)]">›</span>
              </button>
              {isActive ? (
                <div className="app-card absolute top-0 left-[calc(100%+8px)] z-10 min-w-[196px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <MarkdownLinkContextMenuList items={item.items} onClose={onClose} />
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            onClick={() => {
              onClose();
              void item.onSelect();
            }}
          >
            {item.icon ?? <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.checked ? <CheckIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" /> : null}
          </button>
        );
      })}
    </div>
  );
}

async function buildRuntimeFileLinkMenuItems({
  context,
  fileReference,
  targetsResponse,
  t,
}: {
  context: MarkdownLinkContext;
  fileReference: FileReferenceLink;
  targetsResponse: OpenInTargetsResponse | null;
  t: Translate;
}): Promise<RuntimeMenuItem[]> {
  const mode = targetsResponse?.mode ?? "editor";
  const preferredTarget =
    targetsResponse == null
      ? null
      : resolvePreferredOpenTarget({
          preferredTarget: targetsResponse.preferredTarget,
          targets: targetsResponse.targets,
          availableTargets: targetsResponse.availableTargets,
          mode,
        });
  const openWithTargets =
    targetsResponse == null
      ? []
      : filterOpenTargets({
          targets: targetsResponse.targets,
          availableTargets: targetsResponse.availableTargets,
          includeHiddenTargets: true,
          mode,
        });
  const revealLabelKey = getRevealTargetMessageKey();
  const revealTargetSupported = isRevealTargetSupported(context.hostId);
  const preferSidePanelPrimaryAction = shouldOpenMarkdownFileInSidePanel(context, fileReference);
  const preferBrowserPrimaryAction =
    !preferSidePanelPrimaryAction && shouldOpenMarkdownFileInBrowser(context, fileReference);

  const specs = buildFileLinkMenuSpecs({
    mode,
    preferBrowserPrimaryAction,
    preferSidePanelPrimaryAction,
    preferredTarget,
    revealLabelKey,
    revealTargetSupported,
    t,
    targets: openWithTargets,
  });
  const runtimeItems: RuntimeMenuItem[] = [];

  for (const item of specs) {
    if (item.kind === "separator") {
      runtimeItems.push(item);
      continue;
    }

    if (item.kind === "submenu") {
      runtimeItems.push({
        id: item.id,
        kind: "submenu",
        label: item.label,
        icon: <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
        items: item.items.map((targetItem) => ({
          id: targetItem.id,
          kind: "action",
          label: targetItem.label,
          checked: targetItem.checked,
          icon: renderOpenTargetIcon(targetItem.target.kind),
          onSelect: () =>
            openMarkdownFile({
              context,
              fileReference,
              target: targetItem.target.target,
            }),
        })),
      });
      continue;
    }

    if (item.key === "copy-path") {
      runtimeItems.push({
        id: item.id,
        kind: "action",
        label: item.label,
        icon: <CopyPathIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
        onSelect: () => {
          void writeClipboardText(fileReference.path);
        },
      });
      continue;
    }

    if (item.key === "reveal-path") {
      runtimeItems.push({
        id: item.id,
        kind: "action",
        label: item.label,
        icon: <FolderIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
        onSelect: () =>
          openMarkdownFile({
            context,
            fileReference,
            target: "fileManager",
          }),
      });
      continue;
    }

    runtimeItems.push({
      id: item.id,
      kind: "action",
      label: item.label,
      checked: item.checked,
      icon: renderOpenTargetIcon(item.target?.kind ?? null),
      onSelect: () => {
        if (item.key === "open-primary" && preferSidePanelPrimaryAction) {
          openMarkdownFileInSidePanel(context, fileReference);
          return;
        }

        if (item.key === "open-primary" && preferBrowserPrimaryAction) {
          openMarkdownFileInBrowser(context, fileReference);
          return;
        }

        return openMarkdownFile({
          context,
          fileReference,
          target: item.target?.target ?? null,
        });
      },
    });
  }

  return runtimeItems;
}

function shouldOpenMarkdownFileInSidePanel(context: MarkdownLinkContext, fileReference: FileReferenceLink) {
  return context.onFileLinkOpen != null && context.canFileLinkOpenInSidePanel?.(fileReference) === true;
}

function shouldOpenMarkdownFileInBrowser(context: MarkdownLinkContext, fileReference: FileReferenceLink) {
  return context.onFileLinkOpenInBrowser != null && isRevealTargetSupported(context.hostId) && isMarkdownBrowserViewablePath(fileReference.path);
}

function openMarkdownFileInSidePanel(context: MarkdownLinkContext, fileReference: FileReferenceLink) {
  context.onFileLinkOpen?.(fileReference);
}

function openMarkdownFileInBrowser(context: MarkdownLinkContext, fileReference: FileReferenceLink) {
  context.onFileLinkOpenInBrowser?.(fileReference);
}

async function openMarkdownFile({
  context,
  fileReference,
  target,
}: {
  context: MarkdownLinkContext;
  fileReference: FileReferenceLink;
  target: string | null;
}) {
  await openFile({
    cwd: context.cwd ?? null,
    hostId: context.hostId ?? null,
    path: fileReference.path,
    line: fileReference.line,
    column: fileReference.column,
    target,
  });
}

async function readMarkdownOpenTargets({
  context,
  path,
}: {
  context: MarkdownLinkContext;
  path: string;
}) {
  if (!isOpenTargetsSupportedHost(context.hostId)) {
    return null;
  }

  try {
    const { readOpenInTargets } = await import("../services/openTargets");
    return await readOpenInTargets({
      cwd: context.cwd ?? null,
      hostId: context.hostId ?? null,
      path,
    });
  } catch {
    return null;
  }
}

function getHtmlAnchorHref(target: EventTarget | null) {
  return (target as HTMLElement | null)?.closest("a")?.getAttribute("href") ?? null;
}

function isModifiedActivation(event: Pick<ReactMouseEvent<HTMLElement>, "ctrlKey" | "metaKey">) {
  return event.metaKey || event.ctrlKey;
}

function getRevealTargetMessageKey(): MessageKey {
  if (typeof navigator === "undefined") {
    return "markdown.fileReference.openInExplorer";
  }

  const platform = navigator.platform.toLowerCase();
  if (platform.includes("mac")) {
    return "markdown.fileReference.openInFinder";
  }
  if (platform.includes("linux")) {
    return "markdown.fileReference.openInFileManager";
  }

  return "markdown.fileReference.openInExplorer";
}

function isRevealTargetSupported(hostId: string | null | undefined) {
  const normalizedHostId = hostId?.trim();
  return normalizedHostId == null || normalizedHostId.length === 0 || normalizedHostId === "local";
}

function isOpenTargetsSupportedHost(hostId: string | null | undefined) {
  return isRevealTargetSupported(hostId);
}

function isMarkdownBrowserViewablePath(path: string) {
  return /\.html?$/i.test(path.trim().replace(/[?#].*$/, ""));
}

function renderOpenTargetIcon(kind: string | null) {
  if (kind === "fileManager") {
    return <FolderIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />;
  }

  if (kind === "systemDefault") {
    return <BrowserTabIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />;
  }

  return <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />;
}

function getSafeMenuPosition(position: MenuPosition) {
  const x = Math.max(12, Math.min(position.x, window.innerWidth - 220));
  const y = Math.max(12, Math.min(position.y, window.innerHeight - 24));
  return {
    left: `${x}px`,
    top: `${y}px`,
  };
}

async function writeClipboardText(value: string) {
  if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
    return;
  }

  await navigator.clipboard.writeText(value).catch(() => {});
}
