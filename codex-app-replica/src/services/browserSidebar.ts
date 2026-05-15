import { invoke } from "@tauri-apps/api/core";

export type BrowserSidebarTarget =
  | {
      kind: "file";
      cwd?: string | null;
      hostId?: string | null;
      path: string;
    }
  | {
      kind: "url";
      url: string;
    };

export type BrowserSidebarBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function navigateBrowserSidebar(target: BrowserSidebarTarget) {
  if (target.kind === "file") {
    await invoke<void>("browser-sidebar-open-file", {
      params: {
        cwd: target.cwd ?? null,
        hostId: target.hostId ?? null,
        path: target.path,
      },
    });
    return;
  }

  await invoke<void>("browser-sidebar-navigate", {
    params: { url: target.url },
  });
}

export async function setBrowserSidebarBounds(bounds: BrowserSidebarBounds) {
  await invoke<void>("browser-sidebar-set-bounds", {
    params: bounds,
  });
}

export async function setBrowserSidebarVisible(visible: boolean) {
  await invoke<void>("browser-sidebar-set-visible", {
    params: { visible },
  });
}
