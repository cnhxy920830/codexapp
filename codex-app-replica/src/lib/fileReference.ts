export type FileReference = {
  path: string;
  line: number | null;
  column: number | null;
};

const FILE_REFERENCE_PATTERN = /^[./~]|^[A-Za-z]:[\\/]/;

export function parseFileReference(value: string): FileReference | null {
  const decodedValue = decodeURIComponent(value);
  const normalized = decodedValue.replaceAll("/", "\\");
  const windowsMatch = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(normalized);
  if (!windowsMatch) {
    return null;
  }

  const path = windowsMatch[1]?.trim() ?? "";
  if (path.length === 0) {
    return null;
  }

  return {
    path,
    line: parsePositiveInteger(windowsMatch[2]),
    column: parsePositiveInteger(windowsMatch[3]),
  };
}

export function looksLikeFileReference(value: string) {
  return FILE_REFERENCE_PATTERN.test(value);
}

export function decodeFileUrlPath(source: string) {
  const url = new URL(source);
  const decodedPath = decodeURIComponent(url.pathname);
  if (/^\/[a-z]:\//i.test(decodedPath)) {
    return decodedPath.slice(1);
  }

  return decodedPath;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
