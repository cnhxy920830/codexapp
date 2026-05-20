import {
  Fragment,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { Tooltip, TooltipKeycap } from "./Tooltip";
import { useI18n } from "../i18n/i18n";
import {
  acceleratorsMatch,
  buildAcceleratorFromKeyboardEvent,
  buildModifierOnlyAccelerator,
  commandAllowsBareModifiers,
  findConflictingKeyboardShortcutCommandTitle,
  getCommandKeymapState,
  getCommandShortcutEntries,
  getFilteredKeyboardShortcutCommands,
  getKeyboardShortcutCommandDescription,
  getKeyboardShortcutCommandTitle,
  getResetRowIndex,
  onCommandKeymapStateInvalidated,
  peekCommandKeymapState,
  setCommandKeybinding,
  supportsShortcutAppend,
  type CommandKeybindingUpdate,
  type CommandKeymapState,
  type KeyboardShortcutGateState,
} from "../services/keyboardShortcuts";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";

type CaptureMode = "append" | "replace" | "set";

type CaptureState = {
  commandId: string;
  accelerator: string | null;
  conflictingCommandTitle: string | null;
  mode: CaptureMode;
};

type KeyboardShortcutCaptureRequest = {
  accelerator: string;
  commandId: string;
  currentAccelerator: string | null;
  mode: CaptureMode;
};

type KeyboardShortcutsSettingsViewProps = {
  captureState: CaptureState | null;
  errorByCommandId: Record<string, string | undefined>;
  gateState: KeyboardShortcutGateState;
  isSaving: boolean;
  keymapState: CommandKeymapState | null;
  onCancelCapture: () => void;
  onCaptureShortcut: (request: KeyboardShortcutCaptureRequest) => void;
  onClearShortcut: (commandId: string, accelerator: string) => void;
  onResetCommand: (commandId: string) => void;
  onSearchTextChange: (value: string) => void;
  onStartCapture: (
    commandId: string,
    mode: CaptureMode,
    accelerator: string | null,
  ) => void;
  searchText: string;
};

export function KeyboardShortcutsSettings() {
  const { locale, t } = useI18n();
  const hotkeyWindowEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.hotkeyWindow,
  );
  const globalDictationEnabled =
    useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.dictationPrimary) &&
    useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.dictationSecondary);
  const [captureState, setCaptureState] = useState<CaptureState | null>(null);
  const [errorByCommandId, setErrorByCommandId] = useState<
    Record<string, string | undefined>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [keymapState, setKeymapState] = useState<CommandKeymapState | null>(
    () => peekCommandKeymapState(),
  );
  const [searchText, setSearchText] = useState("");

  const clearCommandError = useEffectEvent((commandId: string) => {
    setErrorByCommandId((current) => {
      if (!(commandId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[commandId];
      return next;
    });
  });

  const loadCommandKeymapState = useEffectEvent(async () => {
    try {
      setKeymapState(await getCommandKeymapState());
    } catch {
      // The upstream page keeps rendering the loading state when the query has no data.
    }
  });

  useEffect(() => {
    void loadCommandKeymapState();
  }, [loadCommandKeymapState]);

  const handleCommandKeymapStateInvalidated = useEffectEvent(() => {
    void loadCommandKeymapState();
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onCommandKeymapStateInvalidated(() => {
      if (!disposed) {
        handleCommandKeymapStateInvalidated();
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleCommandKeymapStateInvalidated]);

  const updateCommandShortcut = useEffectEvent(
    async (commandId: string, update: CommandKeybindingUpdate) => {
      clearCommandError(commandId);
      setIsSaving(true);
      try {
        setKeymapState(await setCommandKeybinding(commandId, update));
      } catch (error) {
        setErrorByCommandId((current) => ({
          ...current,
          [commandId]:
            error instanceof Error
              ? error.message
              : t("settings.keyboardShortcuts.updateError"),
        }));
      } finally {
        setIsSaving(false);
      }
    },
  );

  const startCapture = useEffectEvent(
    (commandId: string, mode: CaptureMode, accelerator: string | null) => {
      clearCommandError(commandId);
      setCaptureState({
        commandId,
        accelerator,
        conflictingCommandTitle: null,
        mode,
      });
    },
  );

  const gateState: KeyboardShortcutGateState = {
    globalDictationEnabled,
    hotkeyWindowEnabled,
  };

  const handleCaptureShortcut = useEffectEvent(
    ({
      accelerator,
      commandId,
      currentAccelerator,
      mode,
    }: KeyboardShortcutCaptureRequest) => {
      if (
        mode !== "append" &&
        currentAccelerator != null &&
        acceleratorsMatch(currentAccelerator, accelerator)
      ) {
        setCaptureState(null);
        return;
      }

      const conflictingCommandTitle =
        findConflictingKeyboardShortcutCommandTitle(
          accelerator,
          commandId,
          keymapState,
          locale,
          gateState,
        );
      if (conflictingCommandTitle != null) {
        setCaptureState((current) =>
          current?.commandId === commandId
            ? { ...current, conflictingCommandTitle }
            : current,
        );
        return;
      }

      setCaptureState(null);
      void updateCommandShortcut(
        commandId,
        mode === "append"
          ? {
              type: "append",
              accelerator,
            }
          : currentAccelerator == null
            ? {
                type: "set",
                accelerator,
              }
            : {
                type: "replace",
                previousAccelerator: currentAccelerator,
                accelerator,
              },
      );
    },
  );

  return (
    <KeyboardShortcutsSettingsView
      captureState={captureState}
      errorByCommandId={errorByCommandId}
      gateState={gateState}
      isSaving={isSaving}
      keymapState={keymapState}
      onCancelCapture={() => setCaptureState(null)}
      onCaptureShortcut={handleCaptureShortcut}
      onClearShortcut={(commandId, accelerator) => {
        void updateCommandShortcut(commandId, {
          type: "remove",
          accelerator,
        });
      }}
      onResetCommand={(commandId) => {
        void updateCommandShortcut(commandId, { type: "reset" });
      }}
      onSearchTextChange={setSearchText}
      onStartCapture={startCapture}
      searchText={searchText}
    />
  );
}

export function KeyboardShortcutsSettingsView({
  captureState,
  errorByCommandId,
  gateState,
  isSaving,
  keymapState,
  onCancelCapture,
  onCaptureShortcut,
  onClearShortcut,
  onResetCommand,
  onSearchTextChange,
  onStartCapture,
  searchText,
}: KeyboardShortcutsSettingsViewProps) {
  const { locale, t } = useI18n();
  const filteredCommands = getFilteredKeyboardShortcutCommands(
    searchText,
    locale,
    gateState,
  );

  return (
    <SettingsContentLayout
      title={<SettingsSectionTitle slug="keyboard-shortcuts" />}
    >
      <SettingsGroup>
        <SettingsGroup.Content>
          {keymapState == null ? null : (
            <input
              className="w-full rounded-md border border-token-border bg-transparent px-3 py-2 text-sm text-token-text-primary outline-none placeholder:text-token-text-tertiary"
              aria-label={t("settings.keyboardShortcuts.search.ariaLabel")}
              placeholder={t("settings.keyboardShortcuts.search.placeholder")}
              value={searchText}
              onChange={(event) => {
                onSearchTextChange(event.currentTarget.value);
              }}
            />
          )}

          <SettingsSurface className="overflow-hidden">
            {keymapState == null ? (
              <div className="px-4 py-3 text-sm text-token-text-secondary">
                {t("settings.keyboardShortcuts.loading")}
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col />
                  <col className="w-64" />
                  <col className="w-32" />
                </colgroup>
                <thead className="text-left text-token-text-tertiary">
                  <tr className="border-b border-token-border">
                    <th className="px-4 py-2 font-medium">
                      {t("settings.keyboardShortcuts.table.command")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("settings.keyboardShortcuts.table.keybinding")}
                    </th>
                    <th className="px-4 py-2">
                      <span className="sr-only">
                        {t("settings.keyboardShortcuts.table.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommands.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-3 text-token-text-secondary"
                        colSpan={3}
                      >
                        {t("settings.keyboardShortcuts.noMatches")}
                      </td>
                    </tr>
                  ) : null}

                  {filteredCommands.map((command, commandIndex) => {
                    const commandTitle = getKeyboardShortcutCommandTitle(
                      command,
                      locale,
                    );
                    const commandDescription =
                      getKeyboardShortcutCommandDescription(command, locale);
                    const shortcutEntries = getCommandShortcutEntries(
                      command.id,
                      keymapState,
                    );
                    const hasCustomBinding = keymapState.bindings.some(
                      (binding) => binding.command === command.id,
                    );
                    const resetRowIndex = getResetRowIndex(
                      command.id,
                      hasCustomBinding,
                      shortcutEntries,
                    );
                    const isCaptureForCommand =
                      captureState?.commandId === command.id;
                    const isAppending =
                      isCaptureForCommand && captureState.mode === "append";
                    const displayEntries =
                      isAppending && shortcutEntries.length > 0
                        ? [...shortcutEntries, null]
                        : shortcutEntries.length === 0
                          ? [null]
                          : shortcutEntries;

                    return (
                      <Fragment key={command.id}>
                        {displayEntries.map((entry, rowIndex) => {
                          const isPrimaryRow = rowIndex === 0;
                          const rowPaddingClass = isPrimaryRow
                            ? "px-4 pt-2 pb-1"
                            : "px-4 pt-1 pb-2";
                          const isCapturing =
                            isCaptureForCommand &&
                            (captureState.mode === "append"
                              ? entry == null &&
                                rowIndex === shortcutEntries.length
                              : captureState.accelerator ===
                                (entry?.accelerator ?? null));

                          return (
                            <tr
                              key={`${command.id}-${entry?.accelerator ?? "unassigned"}-${rowIndex}`}
                              className={
                                isPrimaryRow && commandIndex > 0
                                  ? "group border-t border-token-border align-middle"
                                  : "group align-middle"
                              }
                            >
                              <td className={rowPaddingClass}>
                                {isPrimaryRow ? (
                                  <>
                                    <span className="block truncate text-token-text-primary">
                                      {commandTitle}
                                    </span>
                                    {commandDescription ? (
                                      <span className="mt-0.5 block truncate text-xs text-token-text-secondary">
                                        {commandDescription}
                                      </span>
                                    ) : null}
                                    {errorByCommandId[command.id] ? (
                                      <span className="mt-0.5 block text-xs text-token-error-foreground">
                                        {errorByCommandId[command.id]}
                                      </span>
                                    ) : null}
                                  </>
                                ) : null}
                              </td>

                              <td
                                className={rowPaddingClass}
                                colSpan={isCapturing ? 2 : undefined}
                              >
                                {isCapturing ? (
                                  <ShortcutCaptureField
                                    allowsBareModifiers={commandAllowsBareModifiers(
                                      command,
                                    )}
                                    commandTitle={commandTitle}
                                    conflictingCommandTitle={
                                      captureState?.conflictingCommandTitle ??
                                      null
                                    }
                                    onCancel={onCancelCapture}
                                    onCapture={(accelerator) => {
                                      if (!captureState) {
                                        return;
                                      }
                                      onCaptureShortcut({
                                        accelerator,
                                        commandId: command.id,
                                        currentAccelerator:
                                          entry?.accelerator ?? null,
                                        mode: captureState.mode,
                                      });
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <ShortcutLabel
                                      shortcutLabel={entry?.label ?? null}
                                    />
                                    <ShortcutEditButton
                                      canAppend={supportsShortcutAppend(command)}
                                      commandTitle={commandTitle}
                                      hasShortcut={entry != null}
                                      isPending={isSaving}
                                      onStartCapture={(mode) => {
                                        onStartCapture(
                                          command.id,
                                          mode,
                                          mode === "append"
                                            ? null
                                            : entry?.accelerator ?? null,
                                        );
                                      }}
                                    />
                                  </div>
                                )}
                              </td>

                              {isCapturing ? null : (
                                <td className={rowPaddingClass}>
                                  <ShortcutRowActions
                                    commandTitle={commandTitle}
                                    hasCustomBinding={hasCustomBinding}
                                    hasShortcut={entry != null}
                                    isPending={isSaving}
                                    showReset={rowIndex === resetRowIndex}
                                    onClear={() => {
                                      if (entry == null) {
                                        return;
                                      }
                                      onClearShortcut(
                                        command.id,
                                        entry.accelerator,
                                      );
                                    }}
                                    onReset={() => onResetCommand(command.id)}
                                  />
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function ShortcutCaptureField({
  allowsBareModifiers,
  commandTitle,
  conflictingCommandTitle,
  onCancel,
  onCapture,
}: {
  allowsBareModifiers: boolean;
  commandTitle: string;
  conflictingCommandTitle: string | null;
  onCancel: () => void;
  onCapture: (accelerator: string) => void;
}) {
  const { t } = useI18n();
  const pendingModifierAcceleratorRef = useRef<string | null>(null);

  const cancelCapture = () => {
    pendingModifierAcceleratorRef.current = null;
    onCancel();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.repeat) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      cancelCapture();
      return;
    }

    if (allowsBareModifiers) {
      const modifierOnlyAccelerator = buildModifierOnlyAccelerator(
        event.nativeEvent,
        "pressed",
      );
      if (modifierOnlyAccelerator != null) {
        pendingModifierAcceleratorRef.current = modifierOnlyAccelerator;
        return;
      }
    }

    pendingModifierAcceleratorRef.current = null;
    const accelerator = buildAcceleratorFromKeyboardEvent(event.nativeEvent);
    if (accelerator != null) {
      onCapture(accelerator);
    }
  };

  const handleKeyUp = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!allowsBareModifiers) {
      return;
    }

    const modifierOnlyAccelerator = buildModifierOnlyAccelerator(
      event.nativeEvent,
      "released",
    );
    if (
      modifierOnlyAccelerator != null &&
      pendingModifierAcceleratorRef.current === modifierOnlyAccelerator
    ) {
      pendingModifierAcceleratorRef.current = null;
      onCapture(modifierOnlyAccelerator);
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <input
          data-codex-shortcut-capture
          autoFocus
          readOnly
          value={t("settings.keyboardShortcuts.capturePrompt")}
          onBlur={cancelCapture}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          aria-label={t("settings.keyboardShortcuts.captureAriaLabel", {
            commandTitle,
          })}
          className="h-token-button-composer w-36 rounded-lg border border-token-border bg-token-input-background px-3 py-0 text-sm text-token-text-primary shadow-sm outline-none"
        />
        <Button
          color="ghost"
          size="toolbar"
          onMouseDown={preventDefaultMouseDown}
          onClick={cancelCapture}
        >
          {t("settings.keyboardShortcuts.captureCancel")}
        </Button>
      </div>

      {conflictingCommandTitle ? (
        <span className="text-xs text-token-editor-warning-foreground">
          {t("settings.keyboardShortcuts.captureConflict", {
            commandTitle: conflictingCommandTitle,
          })}
        </span>
      ) : null}
    </div>
  );
}

function ShortcutLabel({ shortcutLabel }: { shortcutLabel: string | null }) {
  const { t } = useI18n();

  return (
    <span className="flex min-h-8 items-center gap-1 text-token-text-secondary">
      {shortcutLabel == null ? (
        t("settings.keyboardShortcuts.unassigned")
      ) : (
        <TooltipKeycap keysLabel={shortcutLabel} />
      )}
    </span>
  );
}

function ShortcutRowActions({
  commandTitle,
  hasCustomBinding,
  hasShortcut,
  isPending,
  onClear,
  onReset,
  showReset,
}: {
  commandTitle: string;
  hasCustomBinding: boolean;
  hasShortcut: boolean;
  isPending: boolean;
  onClear: () => void;
  onReset: () => void;
  showReset: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-end gap-1">
      {hasShortcut ? (
        <ShortcutToolbarButton
          ariaLabel={t("settings.keyboardShortcuts.clearAriaLabel", {
            commandTitle,
          })}
          className="disabled:!opacity-100"
          disabled={isPending}
          onClick={onClear}
        >
          <TrashIcon className="icon-xs" />
        </ShortcutToolbarButton>
      ) : null}

      {showReset && hasCustomBinding ? (
        <ShortcutToolbarButton
          ariaLabel={t("settings.keyboardShortcuts.resetAriaLabel", {
            commandTitle,
          })}
          className="disabled:!opacity-100"
          disabled={isPending}
          onClick={onReset}
        >
          <UndoIcon className="icon-xs" />
        </ShortcutToolbarButton>
      ) : null}
    </div>
  );
}

function ShortcutEditButton({
  canAppend,
  commandTitle,
  hasShortcut,
  isPending,
  onStartCapture,
}: {
  canAppend: boolean;
  commandTitle: string;
  hasShortcut: boolean;
  isPending: boolean;
  onStartCapture: (mode: CaptureMode) => void;
}) {
  const { t } = useI18n();
  const [isAppendIntent, setIsAppendIntent] = useState(false);

  const ariaLabel = !hasShortcut
    ? t("settings.keyboardShortcuts.setAriaLabel", { commandTitle })
    : isAppendIntent
      ? t("settings.keyboardShortcuts.createAriaLabel", { commandTitle })
      : t("settings.keyboardShortcuts.changeAriaLabel", { commandTitle });

  return (
    <ShortcutToolbarButton
      ariaLabel={ariaLabel}
      className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 disabled:!opacity-0 group-focus-within:disabled:!opacity-40 group-hover:disabled:!opacity-40"
      disabled={isPending}
      onClick={(event) => {
        const mode: CaptureMode =
          hasShortcut && canAppend && event.shiftKey
            ? "append"
            : hasShortcut
              ? "replace"
              : "set";
        onStartCapture(mode);
      }}
      onMouseEnter={(event) => {
        setIsAppendIntent(canAppend && hasShortcut && event.shiftKey);
      }}
      onMouseMove={(event) => {
        setIsAppendIntent(canAppend && hasShortcut && event.shiftKey);
      }}
      onMouseLeave={() => setIsAppendIntent(false)}
    >
      <PencilIcon className="icon-xs" />
    </ShortcutToolbarButton>
  );
}

function ShortcutToolbarButton({
  ariaLabel,
  children,
  className,
  disabled,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: () => void;
  onMouseMove?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const button = (
    <Button
      aria-label={ariaLabel}
      color="ghost"
      size="toolbar"
      uniform
      className={className}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </Button>
  );

  if (disabled) {
    return button;
  }

  return (
    <Tooltip tooltipContent={ariaLabel}>
      {button}
    </Tooltip>
  );
}

function preventDefaultMouseDown(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.7313 4.20472C13.1489 2.92391 15.3377 2.96644 16.7039 4.33265L16.8318 4.46742C18.0713 5.8393 18.0713 7.93343 16.8318 9.30531L16.7039 9.44007L10.4119 15.7311C10.0884 16.0546 9.85387 16.2917 9.62188 16.4821L9.3875 16.6588C9.18236 16.799 8.96432 16.9196 8.73711 17.0192L8.50762 17.1119C8.32585 17.1785 8.13845 17.2266 7.92168 17.2711L7.15703 17.4069L4.76348 17.8053C4.62062 17.8291 4.46916 17.8552 4.34063 17.8649C4.24185 17.8723 4.10835 17.875 3.9627 17.8395L3.81426 17.7907C3.59124 17.695 3.40749 17.5271 3.2918 17.316L3.2459 17.2223C3.1596 17.0209 3.16176 16.8276 3.17168 16.6959C3.18138 16.5674 3.20744 16.4159 3.23125 16.2731L3.62969 13.8795L3.76445 13.1149C3.80902 12.898 3.85797 12.7108 3.92461 12.5289L4.01738 12.2985C4.11693 12.0715 4.23774 11.854 4.37774 11.6491L4.55352 11.4147C4.74395 11.1825 4.98173 10.9484 5.30547 10.6246L11.5965 4.33265L11.7313 4.20472ZM6.2459 11.5651C5.89673 11.9142 5.71261 12.0998 5.58672 12.2526L5.47539 12.3991C5.38197 12.5358 5.30159 12.6812 5.23516 12.8327L5.17363 12.9869C5.1333 13.0971 5.1025 13.2125 5.06817 13.3815L4.94121 14.0983L4.54277 16.4918L4.5418 16.4938H4.54473L6.93828 16.0944L7.65508 15.9684C7.82408 15.9341 7.93949 15.9033 8.04961 15.8629L8.20293 15.8014C8.35464 15.7349 8.49956 15.6538 8.63652 15.5602L8.78399 15.4498C8.93677 15.3239 9.12233 15.1398 9.47149 14.7907L14.4588 9.80238L11.2332 6.57679L6.2459 11.5651ZM15.7635 5.27308C14.9282 4.43776 13.6058 4.38573 12.7098 5.11683L12.5369 5.27308L12.1736 5.63636L15.4002 8.86195L15.7635 8.49964L15.9197 8.32581C16.6016 7.48961 16.6016 6.28311 15.9197 5.44691L15.7635 5.27308Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.6299 1.33496C12.0335 1.33496 13.2695 2.25996 13.666 3.60645L13.8809 4.33496H17L17.1338 4.34863C17.4369 4.41057 17.665 4.67858 17.665 5C17.665 5.32142 17.4369 5.58943 17.1338 5.65137L17 5.66504H16.6543L15.8574 14.9912C15.7177 16.629 14.3478 17.8877 12.7041 17.8877H7.2959C5.75502 17.8877 4.45439 16.7815 4.18262 15.2939L4.14258 14.9912L3.34668 5.66504H3C2.63273 5.66504 2.33496 5.36727 2.33496 5C2.33496 4.63273 2.63273 4.33496 3 4.33496H6.11914L6.33398 3.60645L6.41797 3.3584C6.88565 2.14747 8.05427 1.33496 9.37012 1.33496H10.6299ZM5.46777 14.8779L5.49121 15.0537C5.64881 15.9161 6.40256 16.5576 7.2959 16.5576H12.7041C13.6571 16.5576 14.4512 15.8275 14.5322 14.8779L15.3193 5.66504H4.68164L5.46777 14.8779ZM7.66797 12.8271V8.66016C7.66797 8.29299 7.96588 7.99528 8.33301 7.99512C8.70028 7.99512 8.99805 8.29289 8.99805 8.66016V12.8271C8.99779 13.1942 8.70012 13.4912 8.33301 13.4912C7.96604 13.491 7.66823 13.1941 7.66797 12.8271ZM11.002 12.8271V8.66016C11.002 8.29289 11.2997 7.99512 11.667 7.99512C12.0341 7.9953 12.332 8.293 12.332 8.66016V12.8271C12.3318 13.1941 12.0339 13.491 11.667 13.4912C11.2999 13.4912 11.0022 13.1942 11.002 12.8271ZM9.37012 2.66504C8.60726 2.66504 7.92938 3.13589 7.6582 3.83789L7.60938 3.98145L7.50586 4.33496H12.4941L12.3906 3.98145C12.1607 3.20084 11.4437 2.66504 10.6299 2.66504H9.37012Z" />
    </svg>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15.998 10.833C15.9978 8.439 14.0571 6.49805 11.663 6.49805H4.9355L7.13374 8.69629L7.2187 8.80078C7.38911 9.05884 7.36084 9.40947 7.13374 9.63672C6.90652 9.86394 6.55592 9.89207 6.2978 9.72168L6.19331 9.63672L2.85932 6.30371C2.5999 6.04411 2.60001 5.62295 2.85932 5.36328L6.19331 2.0293C6.45298 1.76998 6.87414 1.76987 7.13374 2.0293C7.39344 2.289 7.39344 2.711 7.13374 2.9707L4.93647 5.16797H11.663C14.7916 5.16797 17.3279 7.70446 17.3281 10.833C17.3281 13.9617 14.7917 16.498 11.663 16.498H8.33003C7.96276 16.498 7.66499 16.2003 7.66499 15.833C7.66516 15.4659 7.96287 15.168 8.33003 15.168H11.663C14.0572 15.168 15.998 13.2272 15.998 10.833Z"
        fill="currentColor"
      />
    </svg>
  );
}
