import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyPathIcon,
  DefaultPermissionsIcon,
  GuardianApprovalsIcon,
  LinkExternalIcon,
  SearchClearIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import type {
  PluginSharePrincipal,
  PluginSharePrincipalRole,
  PluginSharePrincipalType,
  PluginShareTarget,
  WorkspaceUserSummary,
} from "../../services/plugins";

type ShareAccessMode = "invited" | "workspace" | "link";

type EditablePrincipal = {
  email: string | null;
  id: string;
  name: string;
  role: PluginSharePrincipalRole;
  type: Exclude<PluginSharePrincipalType, "workspace">;
};

type WorkspacePrincipal = {
  principalType: "workspace";
  principalId: string;
  role: PluginSharePrincipalRole;
};

type PluginShareDialogProps = {
  accountId: string | null;
  initialPrincipals: PluginSharePrincipal[];
  isSaving: boolean;
  onClose: () => void;
  onCopyLink: () => Promise<boolean>;
  onSaveTargets: (targets: PluginShareTarget[]) => Promise<PluginSharePrincipal[]>;
  onSearchWorkspaceUsers: (query: string) => Promise<WorkspaceUserSummary[]>;
  pluginDisplayName: string;
};

export function PluginShareDialog({
  accountId,
  initialPrincipals,
  isSaving,
  onClose,
  onCopyLink,
  onSaveTargets,
  onSearchWorkspaceUsers,
  pluginDisplayName,
}: PluginShareDialogProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingUsers, setPendingUsers] = useState<WorkspaceUserSummary[]>([]);
  const [shareAccess, setShareAccess] = useState<ShareAccessMode>(() => resolveShareAccess(initialPrincipals));
  const [editablePrincipals, setEditablePrincipals] = useState<EditablePrincipal[]>(
    () => toEditablePrincipals(initialPrincipals),
  );
  const [copyFailed, setCopyFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [workspaceUsersLoading, setWorkspaceUsersLoading] = useState(false);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserSummary[] | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const copyTimeoutRef = useRef<number | null>(null);
  const workspacePrincipal = useMemo(
    () => findWorkspacePrincipal(initialPrincipals),
    [initialPrincipals],
  );

  useEffect(() => {
    setShareAccess(resolveShareAccess(initialPrincipals));
    setEditablePrincipals(toEditablePrincipals(initialPrincipals));
  }, [initialPrincipals]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length === 0) {
      setWorkspaceUsers(null);
      setWorkspaceUsersLoading(false);
      setHighlightedIndex(0);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setWorkspaceUsersLoading(true);
        try {
          const items = await onSearchWorkspaceUsers(normalizedQuery);
          if (cancelled) {
            return;
          }
          setWorkspaceUsers(items);
          setHighlightedIndex(0);
        } catch {
          if (!cancelled) {
            setWorkspaceUsers([]);
            setHighlightedIndex(0);
          }
        } finally {
          if (!cancelled) {
            setWorkspaceUsersLoading(false);
          }
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [onSearchWorkspaceUsers, searchQuery]);

  const visibleWorkspaceUsers = useMemo(() => {
    return (workspaceUsers ?? []).filter(
      (user) =>
        !pendingUsers.some((entry) => entry.accountUserId === user.accountUserId) &&
        !editablePrincipals.some(
          (entry) => entry.type === "user" && entry.id === user.accountUserId,
        ),
    );
  }, [editablePrincipals, pendingUsers, workspaceUsers]);

  const canSearch = searchQuery.trim().length > 0;

  const handleSaveAccess = async (
    nextPrincipals: EditablePrincipal[],
    nextAccess: ShareAccessMode,
  ) => {
    if (isSaving) {
      return false;
    }
    const nextWorkspacePrincipal =
      nextAccess === "workspace"
        ? workspacePrincipal ??
          (accountId == null
            ? null
            : {
                principalId: accountId,
                principalType: "workspace" as const,
                role: "reader" as const,
              })
        : null;
    if (nextAccess === "workspace" && nextWorkspacePrincipal == null) {
      return false;
    }

    try {
      const principals = await onSaveTargets(
        buildShareTargets(nextPrincipals, nextWorkspacePrincipal),
      );
      setEditablePrincipals(toEditablePrincipals(principals));
      if (nextAccess !== shareAccess) {
        setShareAccess(resolveShareAccess(principals));
      }
      setCopyFailed(false);
      setCopied(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    if (pendingUsers.length > 0) {
      const nextPrincipals = [
        ...editablePrincipals,
        ...pendingUsers.map((user) => ({
          email: user.email,
          id: user.accountUserId,
          name: displayWorkspaceUser(user),
          role: "reader" as const,
          type: "user" as const,
        })),
      ];
      const saved = await handleSaveAccess(nextPrincipals, shareAccess);
      if (saved) {
        setPendingUsers([]);
        setSearchQuery("");
      }
      return;
    }

    const copiedLink = await onCopyLink();
    if (copiedLink) {
      setCopied(true);
      setCopyFailed(false);
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2_000);
      return;
    }
    setCopied(false);
    setCopyFailed(true);
  };

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-label={t("plugins.detail.shareDialog.title", { name: pluginDisplayName })}
        aria-modal="true"
        className="app-card w-full max-w-[560px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        role="dialog"
      >
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="text-[15px] font-medium">
            {t("plugins.detail.shareDialog.title", { name: pluginDisplayName })}
          </div>

          <div className="relative">
            <div className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-base text-token-input-foreground focus-within:border-token-focus-border">
              {pendingUsers.map((user) => (
                <span
                  key={user.accountUserId}
                  className="inline-flex min-w-0 items-center gap-1 rounded-md bg-token-foreground/10 px-2 py-1 text-sm text-token-foreground"
                >
                  <span className="truncate">{user.email ?? displayWorkspaceUser(user)}</span>
                  <button
                    type="button"
                    aria-label={t("plugins.detail.shareDialog.removeSelectedUser", {
                      name: user.email ?? displayWorkspaceUser(user),
                    })}
                    className="cursor-interaction rounded-sm text-token-description-foreground hover:text-token-foreground"
                    onClick={() => {
                      setPendingUsers((current) =>
                        current.filter((entry) => entry.accountUserId !== user.accountUserId),
                      );
                    }}
                  >
                    <SearchClearIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                aria-label={t("plugins.detail.shareDialog.workspaceUserSearch")}
                className="min-w-36 flex-1 bg-transparent outline-none placeholder:text-token-input-placeholder-foreground"
                placeholder={
                  pendingUsers.length === 0
                    ? t("plugins.detail.shareDialog.workspaceUserPlaceholder")
                    : undefined
                }
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (!canSearch) {
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const selected = visibleWorkspaceUsers[highlightedIndex] ?? null;
                    if (selected != null) {
                      setPendingUsers((current) => [...current, selected]);
                      setSearchQuery("");
                    }
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedIndex((current) =>
                      Math.min(current + 1, Math.max(visibleWorkspaceUsers.length - 1, 0)),
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedIndex((current) => Math.max(current - 1, 0));
                  }
                }}
              />
              {pendingUsers.length === 0 ? null : (
                <span className="shrink-0 text-sm text-token-description-foreground">
                  {t("plugins.detail.shareDialog.pendingPermission")}
                </span>
              )}
            </div>
            {canSearch ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-token-border bg-token-bg-primary shadow-sm">
                <div className="max-h-48 overflow-y-auto p-1" role="listbox">
                  {workspaceUsers == null ? (
                    <div className="flex items-center justify-center px-2 py-3 text-token-description-foreground">
                      <Spinner className="icon-xs" />
                    </div>
                  ) : workspaceUsersLoading ? (
                    <div className="flex items-center justify-center px-2 py-3 text-token-description-foreground">
                      <Spinner className="icon-xs" />
                    </div>
                  ) : visibleWorkspaceUsers.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-token-input-placeholder-foreground">
                      {t("plugins.detail.shareDialog.noWorkspaceUsers")}
                    </div>
                  ) : (
                    visibleWorkspaceUsers.map((user, index) => (
                      <button
                        key={user.accountUserId}
                        type="button"
                        aria-selected={index === highlightedIndex}
                        className={[
                          "cursor-interaction flex w-full flex-col rounded-sm px-2 py-1.5 text-left hover:bg-token-list-hover-background",
                          index === highlightedIndex ? "bg-token-list-hover-background" : "",
                        ].join(" ")}
                        role="option"
                        onClick={() => {
                          setPendingUsers((current) => [...current, user]);
                          setSearchQuery("");
                        }}
                      >
                        <span className="text-sm text-token-foreground">
                          {displayWorkspaceUser(user)}
                        </span>
                        {user.email == null ? null : (
                          <span className="text-sm text-token-description-foreground">
                            {user.email}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-base font-medium">
              {t("plugins.detail.shareDialog.whoHasAccess")}
            </div>
            <ShareAccessSelector
              shareAccess={shareAccess}
              onShareAccessChange={(nextAccess) => {
                if (nextAccess === "link") {
                  setShareAccess(nextAccess);
                  return;
                }
                void handleSaveAccess(editablePrincipals, nextAccess).then((saved) => {
                  if (saved) {
                    setShareAccess(nextAccess);
                  }
                });
              }}
            />
            <div className="flex flex-col gap-3">
              {editablePrincipals.length === 0 ? (
                <div className="text-sm text-token-description-foreground">
                  {t("plugins.detail.shareDialog.noInvitedPeople")}
                </div>
              ) : (
                editablePrincipals.map((principal) => (
                  <EditablePrincipalRow
                    key={`${principal.type}:${principal.id}`}
                    principal={principal}
                    onRoleChange={(role) => {
                      void handleSaveAccess(
                        editablePrincipals.map((entry) =>
                          entry.type === principal.type && entry.id === principal.id
                            ? { ...entry, role }
                            : entry,
                        ),
                        shareAccess,
                      );
                    }}
                    onRemoveAccess={() => {
                      void handleSaveAccess(
                        editablePrincipals.filter(
                          (entry) =>
                            entry.type !== principal.type || entry.id !== principal.id,
                        ),
                        shareAccess,
                      );
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {copyFailed ? (
            <div className="text-sm text-token-error-foreground">
              {t("plugins.detail.shareDialog.copyFailed")}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            {pendingUsers.length === 0 ? (
              <Button color="primary" disabled={isSaving} size="medium" type="submit">
                {isSaving ? (
                  <Spinner className="icon-xs" />
                ) : copied ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <CopyPathIcon className="h-3.5 w-3.5" />
                )}
                {copied
                  ? t("plugins.detail.shareDialog.copied")
                  : t("plugins.detail.shareDialog.copyLink")}
              </Button>
            ) : (
              <>
                <Button
                  color="secondary"
                  disabled={isSaving}
                  size="medium"
                  onClick={() => {
                    setPendingUsers([]);
                    setSearchQuery("");
                  }}
                >
                  {t("plugins.detail.shareDialog.cancelInvite")}
                </Button>
                <Button color="primary" disabled={isSaving} size="medium" type="submit">
                  {isSaving ? <Spinner className="icon-xs" /> : null}
                  {t("plugins.detail.shareDialog.invite")}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ShareAccessSelector({
  onShareAccessChange,
  shareAccess,
}: {
  onShareAccessChange: (value: ShareAccessMode) => void;
  shareAccess: ShareAccessMode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex h-10 w-full cursor-interaction items-center gap-2 rounded-md bg-token-foreground/5 px-3 text-left text-base hover:bg-token-foreground/10"
        onClick={() => setOpen((current) => !current)}
      >
        <ShareAccessIcon shareAccess={shareAccess} />
        <span className="min-w-0 flex-1 truncate">
          <ShareAccessLabel shareAccess={shareAccess} />
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-description-foreground" />
      </button>
      {open ? (
        <div className="app-card absolute top-[calc(100%+8px)] left-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {(["invited", "workspace", "link"] as const).map((entry) => {
            const selected = entry === shareAccess;
            return (
              <button
                key={entry}
                type="button"
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                  selected ? "app-nav-item-active" : "app-nav-item-idle",
                ].join(" ")}
                onClick={() => {
                  setOpen(false);
                  onShareAccessChange(entry);
                }}
              >
                <ShareAccessIcon shareAccess={entry} />
                <span className="truncate">
                  <ShareAccessLabel shareAccess={entry} />
                </span>
                {selected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  function ShareAccessLabel({ shareAccess }: { shareAccess: ShareAccessMode }) {
    if (shareAccess === "invited") {
      return <>{t("plugins.detail.shareDialog.access.invited")}</>;
    }
    if (shareAccess === "workspace") {
      return <>{t("plugins.detail.shareDialog.access.workspace")}</>;
    }
    return <>{t("plugins.detail.shareDialog.access.link")}</>;
  }
}

function ShareAccessIcon({ shareAccess }: { shareAccess: ShareAccessMode }) {
  if (shareAccess === "workspace") {
    return <DefaultPermissionsIcon className="h-4 w-4 shrink-0" />;
  }
  if (shareAccess === "link") {
    return <LinkExternalIcon className="h-4 w-4 shrink-0" />;
  }
  return <GuardianApprovalsIcon className="h-4 w-4 shrink-0" />;
}

function EditablePrincipalRow({
  onRemoveAccess,
  onRoleChange,
  principal,
}: {
  onRemoveAccess: () => void;
  onRoleChange: (role: PluginSharePrincipalRole) => void;
  principal: EditablePrincipal;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-token-foreground/10 text-sm font-medium text-token-foreground">
        {principalInitials(principal.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base">{principal.name}</div>
        {principal.email == null ? null : (
          <div className="truncate text-sm text-token-description-foreground">
            {principal.email}
          </div>
        )}
      </div>
      {principal.role === "owner" ? (
        <PrincipalRoleBadge role={principal.role} />
      ) : (
        <PrincipalRoleMenu
          role={principal.role}
          onRemoveAccess={onRemoveAccess}
          onRoleChange={onRoleChange}
        />
      )}
    </div>
  );
}

function PrincipalRoleMenu({
  onRemoveAccess,
  onRoleChange,
  role,
}: {
  onRemoveAccess: () => void;
  onRoleChange: (role: PluginSharePrincipalRole) => void;
  role: PluginSharePrincipalRole;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex cursor-interaction items-center gap-1 rounded-md border border-token-border px-2 py-1 text-sm text-token-foreground"
        onClick={() => setOpen((current) => !current)}
      >
        <PrincipalRoleBadge role={role} />
        <ChevronDownIcon className="h-3 w-3 text-token-description-foreground" />
      </button>
      {open ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {(["reader", "editor"] as const).map((entry) => {
            const selected = entry === role;
            return (
              <button
                key={entry}
                type="button"
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                  selected ? "app-nav-item-active" : "app-nav-item-idle",
                ].join(" ")}
                onClick={() => {
                  setOpen(false);
                  onRoleChange(entry);
                }}
              >
                <PrincipalRoleBadge role={entry} />
                {selected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
              </button>
            );
          })}
          <div className="my-1 border-t border-token-border" />
          <button
            type="button"
            className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-token-error-foreground"
            onClick={() => {
              setOpen(false);
              onRemoveAccess();
            }}
          >
            {t("plugins.detail.shareDialog.permission.remove")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PrincipalRoleBadge({ role }: { role: PluginSharePrincipalRole }) {
  const { t } = useI18n();
  if (role === "reader") {
    return <>{t("plugins.detail.shareDialog.permission.viewer")}</>;
  }
  if (role === "editor") {
    return <>{t("plugins.detail.shareDialog.permission.chat")}</>;
  }
  return <>{t("plugins.detail.shareDialog.permission.owner")}</>;
}

function resolveShareAccess(principals: PluginSharePrincipal[]): ShareAccessMode {
  return principals.some((principal) => principal.principalType === "workspace")
    ? "workspace"
    : "invited";
}

function toEditablePrincipals(principals: PluginSharePrincipal[]): EditablePrincipal[] {
  return principals.flatMap((principal) => {
    if (principal.principalType === "workspace") {
      return [];
    }
    return [
      {
        email: null,
        id: principal.principalId,
        name: principal.name,
        role: principal.role ?? "reader",
        type: principal.principalType,
      },
    ];
  });
}

function buildShareTargets(
  principals: EditablePrincipal[],
  workspacePrincipal: WorkspacePrincipal | null,
): PluginShareTarget[] {
  return [
    ...principals.flatMap((principal) =>
      principal.role === "owner"
        ? []
        : [
            {
              principalId: principal.id,
              principalType: principal.type,
              role: principal.role,
            },
          ],
    ),
    ...(workspacePrincipal == null
      ? []
      : [
          {
            principalId: workspacePrincipal.principalId,
            principalType: workspacePrincipal.principalType,
            role: workspacePrincipal.role,
          },
        ]),
  ];
}

function findWorkspacePrincipal(
  principals: PluginSharePrincipal[],
): WorkspacePrincipal | null {
  const match = principals.find((principal) => principal.principalType === "workspace");
  return match == null
    ? null
    : {
        principalId: match.principalId,
        principalType: "workspace",
        role: match.role ?? "reader",
      };
}

function displayWorkspaceUser(user: WorkspaceUserSummary) {
  return user.name ?? user.email ?? user.accountUserId;
}

function principalInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
