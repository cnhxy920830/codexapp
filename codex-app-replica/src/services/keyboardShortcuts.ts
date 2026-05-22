import { invoke } from "@tauri-apps/api/core";
import commandInventoryData from "../assets/keyboard-shortcuts/commandInventory.json";
import { normalizeLocaleCode } from "../i18n/messages";
import { scoreQueryMatch } from "../lib/scoreQueryMatch";
import {
  emitQueryCacheInvalidated,
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "./queryCache";

export type CommandKeymapState = {
  bindings: CommandKeybinding[];
};

export type CommandKeybinding = {
  command: string;
  key: string | null;
};

export type CommandKeybindingUpdate =
  | { type: "set"; accelerator: string }
  | { type: "append"; accelerator: string }
  | { type: "replace"; previousAccelerator: string; accelerator: string }
  | { type: "remove"; accelerator: string }
  | { type: "reset" };

export type KeyboardShortcutEntry = {
  accelerator: string;
  label: string;
};

type ShortcutScope = "app" | "os-global" | null;

type PlatformDefaultKeybindings = {
  default?: string[];
  macOS?: string[];
} | null;

export type KeyboardShortcutCommand = {
  id: string;
  titleEn: string;
  titleZhCn?: string;
  descriptionEn: string | null;
  descriptionZhCn?: string | null;
  defaultKeybindings: string[];
  platformDefaultKeybindings: PlatformDefaultKeybindings;
  shortcutScope: ShortcutScope;
  allowsBareModifiers: boolean;
  commandMenuGroupKey: string | null;
};

export type KeyboardShortcutGateState = {
  globalDictationEnabled: boolean;
  hotkeyWindowEnabled: boolean;
};

type AcceleratorLocation = "standard" | "left" | "right";

const COMMAND_MENU_GROUP_ORDER = ["thread", "navigation", "panels", "workspace", "skills", "configure", "app"];
const GATE_CONTROLLED_COMMAND_IDS = new Set(["hotkeyWindow", "globalDictationHold", "globalDictationToggle"]);
const DEFAULT_KEYBOARD_SHORTCUT_GATE_STATE: KeyboardShortcutGateState = {
  globalDictationEnabled: false,
  hotkeyWindowEnabled: false,
};
const COMMAND_TITLE_ZH_CN_OVERRIDES: Readonly<Record<string, string>> = {
  newThread: "新对话",
  quickChat: "新建快速对话",
  openThreadInNewWindow: "在新窗口中打开",
  archiveThread: "归档聊天",
  toggleThreadPin: "切换置顶状态",
  copyConversationMarkdown: "复制为 Markdown",
  openSideChat: "打开侧边聊天",
  openControlWindow: "打开控制窗口",
  "composer.openModelPicker": "打开模型选择器",
  "composer.startVoiceMode": "切换语音模式",
  "composer.startDictation": "开始听写",
  openAvatarOverlay: "唤醒宠物",
  previousThread: "上一个对话",
  previousRecentThread: "上一个最近查看的聊天",
  nextThread: "下一个对话",
  nextRecentThread: "下一个最近查看的聊天",
  settings: "设置",
  mcpSettings: "MCP",
  personalitySettings: "个性",
  keyboardShortcuts: "键盘快捷方式",
  manageTasks: "管理自动化功能",
  forceReloadSkills: "强制重新加载技能",
  installPrimaryRuntime: "安装 Codex 工作空间",
  openSkills: "前往技能",
  openFolder: "打开文件夹",
  toggleSidebar: "切换边栏",
  toggleTerminal: "切换终端",
  openBrowserTab: "打开浏览器标签页",
  toggleBrowserPanel: "显示/隐藏浏览器面板",
  toggleDiffPanel: "切换差异面板",
  findInThread: "查找",
  focusBrowserAddressBar: "聚焦浏览器地址栏",
  navigateBack: "返回",
  navigateForward: "前进",
  logOut: "注销",
  feedback: "反馈",
  thread1: "转到聊天 1",
  thread2: "转到聊天 2",
  thread3: "转到聊天 3",
  thread4: "转到聊天 4",
  thread5: "转到聊天 5",
  thread6: "转到聊天 6",
  thread7: "转到聊天 7",
  thread8: "转到聊天 8",
  thread9: "转到聊天 9",
  hotkeyWindow: "弹出窗口快捷键",
  globalDictationHold: "按住听写快捷键",
  globalDictationToggle: "切换听写快捷键",
};
const COMMAND_KEYMAP_STATE_STALE_MS = 60_000;
const MODIFIER_KEYS = new Set(["Meta", "Control", "Alt", "AltGraph", "Shift"]);
const KEY_LABEL_BY_EVENT_KEY = new Map<string, string>([
  ["Escape", "Esc"],
  ["ArrowUp", "Up"],
  ["ArrowDown", "Down"],
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
]);
export const COMMAND_KEYMAP_STATE_QUERY_KEY = ["codex-command-keymap-state"] as const;

export const KEYBOARD_SHORTCUT_COMMANDS = [...(commandInventoryData as KeyboardShortcutCommand[])].sort(
  compareKeyboardShortcutCommands,
);
const KEYBOARD_SHORTCUT_COMMAND_BY_ID = new Map(KEYBOARD_SHORTCUT_COMMANDS.map((command) => [command.id, command]));
let commandKeymapStateCache:
  | {
      state: CommandKeymapState;
      loadedAt: number;
    }
  | null = null;
let pendingCommandKeymapStateLoad: Promise<CommandKeymapState> | null = null;

export async function getCommandKeymapState() {
  const cachedState = peekCommandKeymapState();
  if (cachedState != null) {
    return cachedState;
  }

  if (pendingCommandKeymapStateLoad != null) {
    return pendingCommandKeymapStateLoad;
  }

  pendingCommandKeymapStateLoad = invoke<CommandKeymapState>("get_command_keymap_state")
    .then((state) => {
      setCachedCommandKeymapState(state);
      return state;
    })
    .finally(() => {
      pendingCommandKeymapStateLoad = null;
    });

  return pendingCommandKeymapStateLoad;
}

export async function setCommandKeybinding(commandId: string, update: CommandKeybindingUpdate) {
  const nextState = await invoke<CommandKeymapState>("set_command_keybinding", {
    params: {
      commandId,
      update,
    },
  });
  setCachedCommandKeymapState(nextState);
  await emitQueryCacheInvalidated(COMMAND_KEYMAP_STATE_QUERY_KEY);
  return nextState;
}

export function peekCommandKeymapState() {
  if (
    commandKeymapStateCache == null ||
    Date.now() - commandKeymapStateCache.loadedAt >= COMMAND_KEYMAP_STATE_STALE_MS
  ) {
    return null;
  }

  return commandKeymapStateCache.state;
}

export async function invalidateCommandKeymapState() {
  commandKeymapStateCache = null;
  pendingCommandKeymapStateLoad = null;
  await emitQueryCacheInvalidated(COMMAND_KEYMAP_STATE_QUERY_KEY);
}

export function isCommandKeymapStateInvalidation(notification: QueryCacheInvalidateNotification) {
  return queryKeyMatchesPrefix(notification.queryKey, COMMAND_KEYMAP_STATE_QUERY_KEY);
}

export function onCommandKeymapStateInvalidated(
  handler: (notification: QueryCacheInvalidateNotification) => void,
) {
  return onQueryCacheInvalidated((notification) => {
    if (isCommandKeymapStateInvalidation(notification)) {
      handler(notification);
    }
  });
}

export function getKeyboardShortcutCommandTitle(command: KeyboardShortcutCommand, locale: string) {
  if (normalizeLocaleCode(locale).startsWith("zh")) {
    return COMMAND_TITLE_ZH_CN_OVERRIDES[command.id] ?? command.titleZhCn ?? command.titleEn;
  }

  return command.titleEn;
}

export function getKeyboardShortcutCommandDescription(command: KeyboardShortcutCommand, locale: string) {
  return normalizeLocaleCode(locale).startsWith("zh")
    ? command.descriptionZhCn ?? command.descriptionEn
    : command.descriptionEn;
}

export function getFilteredKeyboardShortcutCommands(
  query: string,
  locale: string,
  gateState: KeyboardShortcutGateState = DEFAULT_KEYBOARD_SHORTCUT_GATE_STATE,
) {
  const visibleCommands = getVisibleKeyboardShortcutCommands(gateState);
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return visibleCommands;
  }

  return visibleCommands.filter((command) => {
    const title = getKeyboardShortcutCommandTitle(command, locale);
    const description = getKeyboardShortcutCommandDescription(command, locale) ?? "";
    return [command.id, title, description].some((candidate) => scoreQueryMatch(candidate, trimmedQuery) > 0);
  });
}

export function getCommandShortcutEntries(commandId: string, keymapState: CommandKeymapState | null) {
  return getCommandShortcutAccelerators(commandId, keymapState).map((accelerator) => ({
    accelerator,
    label: formatAcceleratorLabel(accelerator),
  }));
}

export function getCommandShortcutAccelerators(commandId: string, keymapState: CommandKeymapState | null) {
  const bindings = keymapState?.bindings.filter((binding) => binding.command === commandId) ?? [];
  if (bindings.length > 0) {
    if (bindings.some((binding) => binding.key === null)) {
      return [];
    }
    return bindings.flatMap((binding) => (binding.key ? [binding.key] : []));
  }
  return getDefaultKeybindings(commandId);
}

export function getDefaultKeybindings(commandId: string) {
  const command = KEYBOARD_SHORTCUT_COMMAND_BY_ID.get(commandId);
  if (!command) {
    return [];
  }

  const platformDefaultKeybindings = command.platformDefaultKeybindings;
  if (isMacOs() && platformDefaultKeybindings?.macOS) {
    return platformDefaultKeybindings.macOS;
  }
  if (!isMacOs() && platformDefaultKeybindings?.default) {
    return platformDefaultKeybindings.default;
  }
  return command.defaultKeybindings;
}

export function getResetRowIndex(
  commandId: string,
  hasCustomBinding: boolean,
  shortcutEntries: KeyboardShortcutEntry[],
) {
  if (!hasCustomBinding) {
    return null;
  }

  const defaultKeybindings = getDefaultKeybindings(commandId);
  const firstDifferenceIndex = shortcutEntries.findIndex(
    (entry, index) => entry.accelerator !== defaultKeybindings[index],
  );
  return firstDifferenceIndex === -1 ? 0 : firstDifferenceIndex;
}

export function supportsShortcutAppend(command: KeyboardShortcutCommand) {
  return command.shortcutScope !== "os-global";
}

export function commandAllowsBareModifiers(command: KeyboardShortcutCommand) {
  return command.allowsBareModifiers;
}

export function findConflictingKeyboardShortcutCommandTitle(
  accelerator: string,
  commandId: string,
  keymapState: CommandKeymapState | null,
  locale: string,
  gateState: KeyboardShortcutGateState = DEFAULT_KEYBOARD_SHORTCUT_GATE_STATE,
) {
  for (const command of getVisibleKeyboardShortcutCommands(gateState)) {
    if (command.id === commandId) {
      continue;
    }
    if (
      getCommandShortcutEntries(command.id, keymapState).some((entry) =>
        acceleratorsMatch(entry.accelerator, accelerator),
      )
    ) {
      return getKeyboardShortcutCommandTitle(command, locale);
    }
  }

  return null;
}

function getVisibleKeyboardShortcutCommands(gateState: KeyboardShortcutGateState) {
  return KEYBOARD_SHORTCUT_COMMANDS.filter((command) =>
    isKeyboardShortcutCommandVisible(command.id, gateState),
  );
}

function isKeyboardShortcutCommandVisible(
  commandId: string,
  gateState: KeyboardShortcutGateState,
) {
  if (!GATE_CONTROLLED_COMMAND_IDS.has(commandId)) {
    return true;
  }

  switch (commandId) {
    case "hotkeyWindow":
      return gateState.hotkeyWindowEnabled;
    case "globalDictationHold":
    case "globalDictationToggle":
      return gateState.globalDictationEnabled;
    default:
      return true;
  }
}

export function acceleratorsMatch(left: string, right: string) {
  return formatAcceleratorLabel(left) === formatAcceleratorLabel(right);
}

export function formatAcceleratorLabel(accelerator: string) {
  const isMac = isMacOs();
  const isLinux = !isMac && isLinuxOs();

  if (
    isMac &&
    (accelerator === "LeftCommand+RightCommand" ||
      accelerator === "LeftCmd+RightCmd" ||
      accelerator === "LeftMeta+RightMeta")
  ) {
    return "⌘ + ⌘";
  }

  const segments = accelerator.split("+").filter(Boolean);
  const modifiers = new Set<string>();
  let keySegment: string | null = null;

  for (const segment of segments) {
    switch (segment) {
      case "CmdOrCtrl":
        modifiers.add(isMac ? "Command" : "Ctrl");
        break;
      case "Command":
      case "Cmd":
        modifiers.add(isMac ? "Command" : isLinux ? "Super" : "Win");
        break;
      case "Control":
      case "Ctrl":
        modifiers.add("Ctrl");
        break;
      case "Alt":
      case "Option":
        modifiers.add("Alt");
        break;
      case "Shift":
        modifiers.add("Shift");
        break;
      default:
        keySegment = segment;
        break;
    }
  }

  const keyLabel = formatAcceleratorKey(keySegment, isMac);
  if (isMac) {
    const macModifierSymbols: Record<string, string> = {
      Ctrl: "⌃",
      Alt: "⌥",
      Shift: "⇧",
      Command: "⌘",
    };
    return `${["Ctrl", "Alt", "Shift", "Command"]
      .filter((modifier) => modifiers.has(modifier))
      .map((modifier) => macModifierSymbols[modifier])
      .join("")}${keyLabel}`;
  }

  const orderedModifiers = Array.from(modifiers).map((modifier) => (modifier === "Command" ? "Cmd" : modifier));
  return [...["Ctrl", "Alt", "Shift", "Cmd", "Super", "Win"].filter((modifier) => orderedModifiers.includes(modifier)), keyLabel]
    .filter(Boolean)
    .join("+");
}

export function buildAcceleratorFromKeyboardEvent(event: KeyboardEvent) {
  const key = resolveAcceleratorKey(event.key, event.code);
  if (!key) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.ctrlKey) {
    modifiers.push("Ctrl");
  }
  if (event.metaKey) {
    modifiers.push("Command");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  modifiers.push(key);
  return modifiers.join("+");
}

function resolveAcceleratorKey(key: string, code: string | undefined) {
  if (MODIFIER_KEYS.has(key)) {
    return null;
  }

  return (
    resolveKeyFromCode(code) ??
    (key === " " || key === "\u00A0"
      ? "Space"
      : key === "+"
        ? "Plus"
        : KEY_LABEL_BY_EVENT_KEY.get(key) ??
          (/^f\d{1,2}$/i.test(key)
            ? key.toUpperCase()
            : key.toLowerCase() === "fn"
              ? "Fn"
              : key.length === 1
                ? key.toUpperCase()
                : key))
  );
}

function resolveKeyFromCode(code: string | undefined) {
  if (!code) {
    return null;
  }
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  return code === "Space" ? "Space" : null;
}

function formatAcceleratorKey(key: string | null, isMac: boolean) {
  if (!key) {
    return "";
  }
  if (isMac && key === "Plus") {
    return "+";
  }

  switch (key) {
    case "LeftOption":
      return isMac ? "Left ⌥" : "Left Option";
    case "RightOption":
      return isMac ? "Right ⌥" : "Right Option";
    case "LeftCommand":
      return isMac ? "Left ⌘" : "Left Command";
    case "DoubleCommand":
      return isMac ? "⌘ + ⌘" : "Double Command";
    case "RightCommand":
      return isMac ? "Right ⌘" : "Right Command";
    case "LeftControl":
      return isMac ? "Left ⌃" : "Left Control";
    case "RightControl":
      return isMac ? "Right ⌃" : "Right Control";
    case "LeftShift":
      return isMac ? "Left ⇧" : "Left Shift";
    case "RightShift":
      return isMac ? "Right ⇧" : "Right Shift";
    case "Fn":
      return "Fn";
    default:
      return key;
  }
}

function isMacOs() {
  return typeof navigator !== "undefined" && (navigator.platform ?? "").startsWith("Mac");
}

function isLinuxOs() {
  return typeof navigator !== "undefined" && (navigator.platform ?? "").startsWith("Linux");
}

export function getAcceleratorLocation(event: KeyboardEvent): AcceleratorLocation {
  if (event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
    return "left";
  }
  if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
    return "right";
  }
  return "standard";
}

export function buildModifierOnlyAccelerator(event: KeyboardEvent, state: "pressed" | "released") {
  if (event.key.toLowerCase() === "fn") {
    return "Fn";
  }

  const location = getAcceleratorLocation(event);
  if (location === "standard") {
    return null;
  }

  const side = location === "left" ? "Left" : "Right";
  switch (event.key) {
    case "Alt":
      return state === "released" || (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
        ? `${side}Option`
        : null;
    case "Meta":
      return state === "released" || (event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey)
        ? `${side}Command`
        : null;
    case "Control":
      return side === "Left" &&
        (state === "released" || (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey))
        ? "LeftControl"
        : null;
    case "Shift":
      return null;
    default:
      return null;
  }
}

function compareKeyboardShortcutCommands(left: KeyboardShortcutCommand, right: KeyboardShortcutCommand) {
  const leftGroupIndex = left.commandMenuGroupKey ? COMMAND_MENU_GROUP_ORDER.indexOf(left.commandMenuGroupKey) : -1;
  const rightGroupIndex = right.commandMenuGroupKey ? COMMAND_MENU_GROUP_ORDER.indexOf(right.commandMenuGroupKey) : -1;
  const normalizedLeftGroupIndex = leftGroupIndex === -1 ? COMMAND_MENU_GROUP_ORDER.length : leftGroupIndex;
  const normalizedRightGroupIndex = rightGroupIndex === -1 ? COMMAND_MENU_GROUP_ORDER.length : rightGroupIndex;
  if (normalizedLeftGroupIndex === normalizedRightGroupIndex) {
    return left.id.localeCompare(right.id);
  }
  return normalizedLeftGroupIndex - normalizedRightGroupIndex;
}

function setCachedCommandKeymapState(state: CommandKeymapState) {
  commandKeymapStateCache = {
    state,
    loadedAt: Date.now(),
  };
}
