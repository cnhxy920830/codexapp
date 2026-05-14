import { cloneWorkbookWalnutConfig, WORKBOOK_WALNUT_RESOURCE_URLS } from "./workbookWalnutConfig";
import type { WorkspaceFileWorkbookImportKind } from "./workspaceFilePreviewUtils";

type WorkbookCsvModule = {
  Workbook: {
    fromCSV: (
      contents: string,
      options?: {
        separator?: string;
      },
    ) => Promise<{
      toProto: () => unknown;
    }>;
  };
};

type SpreadsheetProtoModule = {
  Workbook: {
    decode: (input: unknown) => unknown;
  };
};

type WalnutAssemblyExports = {
  XlsxReader: {
    ExtractXlsxProto: (bytes: Uint8Array, readOnly: boolean) => unknown;
  };
};

type DotnetRuntime = {
  getConfig: () => {
    mainAssemblyName?: string;
  };
  getAssemblyExports: (assemblyName: string) => Promise<WalnutAssemblyExports>;
};

type DotnetBuilder = {
  withConfig: (config: unknown) => DotnetBuilder;
  withResourceLoader: (
    loader: (type: string, name: string, defaultUri: string, integrity: string) => string | Promise<Response>,
  ) => DotnetBuilder;
  create: () => Promise<DotnetRuntime>;
};

export type WorkbookPreviewProto = unknown;

const MAX_PARSED_WORKBOOK_CACHE_ENTRIES = 5;

const parsedWorkbookCache = new Map<
  string,
  {
    contentsBytes: Uint8Array;
    workbookProto: WorkbookPreviewProto;
  }
>();

let walnutAssemblyExportsPromise: Promise<WalnutAssemblyExports> | null = null;

export async function loadWorkbookPreviewProto(params: {
  cacheKey: string;
  contentsBase64: string;
  importKind: WorkspaceFileWorkbookImportKind;
}): Promise<WorkbookPreviewProto> {
  const contentsBytes = decodeBase64ToBytes(params.contentsBase64);
  const cachedWorkbookProto = getCachedWorkbookProto(params.cacheKey, contentsBytes);
  if (cachedWorkbookProto != null) {
    return cachedWorkbookProto;
  }

  const workbookProto = await parseWorkbookPreviewProto(contentsBytes, params.importKind);
  setCachedWorkbookProto(params.cacheKey, contentsBytes, workbookProto);
  return workbookProto;
}

async function parseWorkbookPreviewProto(
  contentsBytes: Uint8Array,
  importKind: WorkspaceFileWorkbookImportKind,
): Promise<WorkbookPreviewProto> {
  switch (importKind) {
    case "csv":
      return parseCsvWorkbookPreviewProto(contentsBytes);
    case "tsv":
      return parseCsvWorkbookPreviewProto(contentsBytes, "\t");
    case "xlsx":
      return parseXlsxWorkbookPreviewProto(contentsBytes);
  }
}

async function parseCsvWorkbookPreviewProto(contentsBytes: Uint8Array, separator?: string) {
  // @ts-ignore -- extracted upstream workbook bundle ships without declarations.
  const workbookModule = (await import("../../assets/workbook/workbook-D5Swjf5Y.js")) as WorkbookCsvModule;
  const workbook = await workbookModule.Workbook.fromCSV(
    new TextDecoder().decode(contentsBytes),
    separator == null ? undefined : { separator },
  );
  return workbook.toProto();
}

async function parseXlsxWorkbookPreviewProto(contentsBytes: Uint8Array) {
  const [spreadsheetModule, walnutAssemblyExports] = await Promise.all([
    // @ts-ignore -- extracted upstream workbook bundle ships without declarations.
    import("../../assets/workbook/spreadsheet-2JHjVHI6.js") as Promise<SpreadsheetProtoModule>,
    loadWalnutAssemblyExports(),
  ]);
  return spreadsheetModule.Workbook.decode(walnutAssemblyExports.XlsxReader.ExtractXlsxProto(contentsBytes, false));
}

async function loadWalnutAssemblyExports() {
  walnutAssemblyExportsPromise ??= createWalnutAssemblyExportsPromise().catch((error: unknown) => {
    walnutAssemblyExportsPromise = null;
    throw error;
  });
  return walnutAssemblyExportsPromise;
}

async function createWalnutAssemblyExportsPromise() {
  // @ts-ignore -- extracted upstream workbook runtime ships without declarations.
  const dotnetModule = (await import("../../assets/workbook/dotnet.js")) as {
    dotnet: DotnetBuilder;
  };

  const dotnetRuntime = await dotnetModule.dotnet
    .withConfig(cloneWorkbookWalnutConfig())
    .withResourceLoader((type, name, defaultUri) => {
      if (type === "dotnetjs") {
        return defaultUri;
      }
      return WORKBOOK_WALNUT_RESOURCE_URLS[name] ?? defaultUri;
    })
    .create();

  const mainAssemblyName = dotnetRuntime.getConfig().mainAssemblyName;
  if (!mainAssemblyName) {
    throw new Error("Walnut reader assembly unavailable");
  }

  return dotnetRuntime.getAssemblyExports(mainAssemblyName);
}

function getCachedWorkbookProto(cacheKey: string, contentsBytes: Uint8Array) {
  const cachedEntry = parsedWorkbookCache.get(cacheKey);
  if (cachedEntry == null || cachedEntry.contentsBytes.length !== contentsBytes.length) {
    return null;
  }

  for (let index = 0; index < contentsBytes.length; index += 1) {
    if (cachedEntry.contentsBytes[index] !== contentsBytes[index]) {
      return null;
    }
  }

  parsedWorkbookCache.delete(cacheKey);
  parsedWorkbookCache.set(cacheKey, cachedEntry);
  return cachedEntry.workbookProto;
}

function setCachedWorkbookProto(cacheKey: string, contentsBytes: Uint8Array, workbookProto: WorkbookPreviewProto) {
  parsedWorkbookCache.delete(cacheKey);
  parsedWorkbookCache.set(cacheKey, { contentsBytes, workbookProto });

  while (parsedWorkbookCache.size > MAX_PARSED_WORKBOOK_CACHE_ENTRIES) {
    const oldestCacheKey = parsedWorkbookCache.keys().next().value;
    if (oldestCacheKey == null) {
      return;
    }
    parsedWorkbookCache.delete(oldestCacheKey);
  }
}

function decodeBase64ToBytes(contentsBase64: string) {
  if (typeof window === "undefined") {
    return Uint8Array.from(Buffer.from(contentsBase64, "base64"));
  }

  const binaryString = window.atob(contentsBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}
