import { invoke } from "@tauri-apps/api/core";
import commandInventoryData from "../assets/keyboard-shortcuts/commandInventory.json";
import { normalizeLocaleCode } from "../i18n/messages";

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

export type KeyboardShortcutCommand = {
  id: string;
  titleEn: string;
  titleZhCn?: string;
  defaultKeybindings: string[];
};

type AcceleratorLocation = "standard" | "left" | "right";

const MODIFIER_KEYS = new Set(["Meta", "Control", "Alt", "AltGraph", "Shift"]);
const KEY_LABEL_BY_EVENT_KEY = new Map<string, string>([
  ["Escape", "Esc"],
  ["ArrowUp", "Up"],
  ["ArrowDown", "Down"],
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
]);

export const KEYBOARD_SHORTCUT_COMMANDS = commandInventoryData as KeyboardShortcutCommand[];

export async function getCommandKeymapState() {
  return invoke<CommandKeymapState>("get_command_keymap_state");
}

export async function setCommandKeybinding(commandId: string, update: CommandKeybindingUpdate) {
  return invoke<CommandKeymapState>("set_command_keybinding", {
    params: {
      commandId,
      update,
    },
  });
}

export function getKeyboardShortcutCommandTitle(command: KeyboardShortcutCommand, locale: string) {
  return normalizeLocaleCode(locale).startsWith("zh") ? command.titleZhCn ?? command.titleEn : command.titleEn;
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
  return KEYBOARD_SHORTCUT_COMMANDS.find((command) => command.id === commandId)?.defaultKeybindings ?? [];
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
