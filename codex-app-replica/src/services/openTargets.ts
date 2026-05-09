import { invoke } from "@tauri-apps/api/core";
import androidStudioIcon from "../assets/apps/android-studio.png";
import antigravityIcon from "../assets/apps/antigravity.png";
import cmderIcon from "../assets/apps/cmder.png";
import cursorIcon from "../assets/apps/cursor.png";
import fileExplorerIcon from "../assets/apps/file-explorer.png";
import golandIcon from "../assets/apps/goland.png";
import intellijIcon from "../assets/apps/intellij.png";
import microsoftTerminalIcon from "../assets/apps/microsoft-terminal.png";
import phpstormIcon from "../assets/apps/phpstorm.png";
import pycharmIcon from "../assets/apps/pycharm.png";
import riderIcon from "../assets/apps/rider.png";
import rustroverIcon from "../assets/apps/rustrover.png";
import sublimeTextIcon from "../assets/apps/sublime-text.png";
import terminalIcon from "../assets/apps/terminal.png";
import vscodeInsidersIcon from "../assets/apps/vscode-insiders.png";
import vscodeIcon from "../assets/apps/vscode.png";
import webstormIcon from "../assets/apps/webstorm.svg";
import zedIcon from "../assets/apps/zed.png";

export type OpenTargetMode = "editor" | "native";

export type OpenTargetItem = {
  id: string;
  target: string;
  label: string;
  icon: string | null;
  kind: string;
  hidden: boolean;
  available: boolean;
  default: boolean;
};

export type OpenInTargetsResponse = {
  preferredTarget: string | null;
  availableTargets: string[];
  mode: OpenTargetMode;
  targets: OpenTargetItem[];
};

type RawOpenTargetItem = Omit<OpenTargetItem, "icon"> & {
  icon: string | null;
};

type RawOpenInTargetsResponse = Omit<OpenInTargetsResponse, "targets"> & {
  targets: RawOpenTargetItem[];
};

const OPEN_TARGET_ICON_URLS: Record<string, string> = {
  "apps/android-studio.png": androidStudioIcon,
  "apps/antigravity.png": antigravityIcon,
  "apps/cmder.png": cmderIcon,
  "apps/cursor.png": cursorIcon,
  "apps/file-explorer.png": fileExplorerIcon,
  "apps/goland.png": golandIcon,
  "apps/intellij.png": intellijIcon,
  "apps/microsoft-terminal.png": microsoftTerminalIcon,
  "apps/phpstorm.png": phpstormIcon,
  "apps/pycharm.png": pycharmIcon,
  "apps/rider.png": riderIcon,
  "apps/rustrover.png": rustroverIcon,
  "apps/sublime-text.png": sublimeTextIcon,
  "apps/terminal.png": terminalIcon,
  "apps/vscode-insiders.png": vscodeInsidersIcon,
  "apps/vscode.png": vscodeIcon,
  "apps/webstorm.svg": webstormIcon,
  "apps/zed.png": zedIcon,
};

export async function readOpenInTargets(params: {
  cwd?: string | null;
  hostId?: string | null;
  path?: string | null;
} = {}) {
  const response = await invoke<RawOpenInTargetsResponse>("open-in-targets", { params });
  return {
    ...response,
    targets: response.targets.map((target) => ({
      ...target,
      icon: resolveOpenTargetIcon(target.icon),
    })),
  } satisfies OpenInTargetsResponse;
}

export async function setPreferredApp(target: string) {
  return invoke<{ success: boolean }>("set-preferred-app", {
    params: { target },
  });
}

function resolveOpenTargetIcon(icon: string | null) {
  if (icon == null) {
    return null;
  }
  return OPEN_TARGET_ICON_URLS[icon] ?? `/${icon}`;
}
