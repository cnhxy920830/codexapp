import { readFileText } from "./hostFiles";
import { writeLocalEnvironmentConfig } from "./localEnvironments";

type ProjectConfigField =
  | { name: "approval_policy"; value: string }
  | { name: "sandbox_mode"; value: string }
  | { name: "network_access"; value: boolean };

export async function writeProjectConfigValue(params: {
  filePath: string;
  hostId?: string | null;
  keyPath: string;
  value: string | boolean;
}) {
  const field = mapProjectConfigField(params.keyPath, params.value);
  if (field == null) {
    throw new Error("Unsupported config key for project config write.");
  }

  await saveProjectConfigField({
    filePath: params.filePath,
    hostId: params.hostId,
    field,
  });
}

function mapProjectConfigField(
  keyPath: string,
  value: string | boolean,
): ProjectConfigField | null {
  if (keyPath === "approval_policy" && typeof value === "string") {
    return { name: "approval_policy", value };
  }
  if (keyPath === "sandbox_mode" && typeof value === "string") {
    return { name: "sandbox_mode", value };
  }
  if (keyPath === "sandbox_workspace_write.network_access" && typeof value === "boolean") {
    return { name: "network_access", value };
  }
  return null;
}

async function saveProjectConfigField(params: {
  filePath: string;
  hostId?: string | null;
  field: ProjectConfigField;
}) {
  let raw = "";
  try {
    raw = (
      await readFileText({
        hostId: params.hostId,
        path: params.filePath,
      })
    ).contents;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw new Error("Failed to read project config.");
    }
  }

  const nextRaw = updateProjectConfigToml(raw, params.field);
  if (nextRaw === raw) {
    return;
  }

  try {
    await writeLocalEnvironmentConfig({
      hostId: params.hostId,
      configPath: params.filePath,
      raw: nextRaw,
    });
  } catch {
    throw new Error("Failed to save project config.");
  }
}

function updateProjectConfigToml(raw: string, field: ProjectConfigField) {
  if (field.name === "network_access") {
    return upsertSandboxWorkspaceWriteNetworkAccess(raw, field.value);
  }
  return upsertRootStringField(raw, field.name, field.value);
}

function upsertRootStringField(raw: string, key: "approval_policy" | "sandbox_mode", value: string) {
  const lines = raw.length > 0 ? raw.split("\n") : [];
  let currentSection: string | null = null;
  let replaced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = parseTomlSection(line);
    if (section != null) {
      currentSection = section;
      continue;
    }
    if (currentSection == null && new RegExp(`^\\s*${key}\\s*=`).test(line)) {
      lines[index] = `${key} = "${value}"`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    const firstSectionIndex = lines.findIndex((line) => parseTomlSection(line) != null);
    const insertIndex = firstSectionIndex === -1 ? lines.length : firstSectionIndex;
    lines.splice(insertIndex, 0, `${key} = "${value}"`);
  }

  return ensureTrailingNewline(lines.join("\n"));
}

function upsertSandboxWorkspaceWriteNetworkAccess(raw: string, value: boolean) {
  const lines = raw.length > 0 ? raw.split("\n") : [];
  let inSection = false;
  let insertIndex = lines.length;
  let replaced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = parseTomlSection(line);
    if (section != null) {
      if (inSection) {
        insertIndex = index;
        break;
      }
      if (section === "sandbox_workspace_write") {
        inSection = true;
      }
      continue;
    }
    if (inSection && /^\s*network_access\s*=/.test(line)) {
      lines[index] = `network_access = ${value ? "true" : "false"}`;
      replaced = true;
      break;
    }
  }

  if (inSection && !replaced) {
    lines.splice(insertIndex, 0, `network_access = ${value ? "true" : "false"}`);
    return ensureTrailingNewline(lines.join("\n"));
  }

  if (replaced) {
    return ensureTrailingNewline(lines.join("\n"));
  }

  const normalizedRaw = raw.length > 0 && !raw.endsWith("\n") ? `${raw}\n` : raw;
  return `${normalizedRaw}${normalizedRaw.trim().length === 0 ? "" : "\n"}[sandbox_workspace_write]\nnetwork_access = ${
    value ? "true" : "false"
  }\n`;
}

function ensureTrailingNewline(raw: string) {
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}

function parseTomlSection(line: string) {
  const match = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
  return match?.[1] == null ? null : match[1].trim();
}

function isMissingFileError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.trim().toLowerCase();
  return message === "enoent" || message.includes("no such file") || message.includes("not found");
}
