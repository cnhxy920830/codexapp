import { cloneWorkbookWalnutConfig, WORKBOOK_WALNUT_RESOURCE_URLS } from "./workbookWalnutConfig";
import type { WorkspaceFileWorkbookImportKind } from "./workspaceFilePreviewUtils";

type PresentationProtoModule = {
  Presentation: {
    decode: (input: unknown) => unknown;
  };
};

type DocumentProtoModule = {
  Document: {
    decode: (input: unknown) => unknown;
  };
};

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
  DocxReader: {
    ExtractDocxProto: (bytes: Uint8Array, readOnly: boolean) => unknown;
  };
  PptxReader: {
    ExtractSlidesProto: (bytes: Uint8Array, readOnly: boolean) => unknown;
  };
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

export type ArtifactPreviewProto = unknown;
export type DocumentPreviewProto = ArtifactPreviewProto;
export type PresentationPreviewProto = ArtifactPreviewProto;
export type WorkbookPreviewProto = ArtifactPreviewProto;
export type ParsedArtifactPreview =
  | {
      kind: "document";
      proto: DocumentPreviewProto;
    }
  | {
      kind: "presentation";
      proto: PresentationPreviewProto;
    }
  | {
      kind: "spreadsheet";
      proto: WorkbookPreviewProto;
    };
export type WorkspaceFileParsedArtifactImportKind = WorkspaceFileWorkbookImportKind | "docx" | "pptx";

const MAX_PARSED_WORKBOOK_CACHE_ENTRIES = 5;

const parsedArtifactCache = new Map<
  string,
  {
    contentsBytes: Uint8Array;
    parsedArtifact: ParsedArtifactPreview;
  }
>();

let walnutAssemblyExportsPromise: Promise<WalnutAssemblyExports> | null = null;

export async function loadArtifactPreviewProto(params: {
  cacheKey: string;
  contentsBase64: string;
  importKind: WorkspaceFileParsedArtifactImportKind;
}): Promise<ParsedArtifactPreview> {
  const contentsBytes = decodeBase64ToBytes(params.contentsBase64);
  const cachedParsedArtifact = getCachedArtifactProto(params.cacheKey, contentsBytes);
  if (cachedParsedArtifact != null) {
    return cachedParsedArtifact;
  }

  const parsedArtifact = await parseArtifactPreviewProto(contentsBytes, params.importKind);
  setCachedArtifactProto(params.cacheKey, contentsBytes, parsedArtifact);
  return parsedArtifact;
}

async function parseArtifactPreviewProto(
  contentsBytes: Uint8Array,
  importKind: WorkspaceFileParsedArtifactImportKind,
): Promise<ParsedArtifactPreview> {
  switch (importKind) {
    case "csv":
      return parseCsvWorkbookPreviewProto(contentsBytes);
    case "docx":
      return parseDocxPreviewProto(contentsBytes);
    case "pptx":
      return parsePptxPreviewProto(contentsBytes);
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
  return {
    kind: "spreadsheet" as const,
    proto: workbook.toProto(),
  };
}

async function parseDocxPreviewProto(contentsBytes: Uint8Array) {
  const [documentModule, walnutAssemblyExports] = await Promise.all([
    // @ts-ignore -- extracted upstream document bundle ships without declarations.
    import("../../assets/workbook/document-C3vk4qvU.js") as Promise<DocumentProtoModule>,
    loadWalnutAssemblyExports(),
  ]);
  return {
    kind: "document" as const,
    proto: documentModule.Document.decode(walnutAssemblyExports.DocxReader.ExtractDocxProto(contentsBytes, false)),
  };
}

async function parseXlsxWorkbookPreviewProto(contentsBytes: Uint8Array) {
  const [spreadsheetModule, walnutAssemblyExports] = await Promise.all([
    // @ts-ignore -- extracted upstream workbook bundle ships without declarations.
    import("../../assets/workbook/spreadsheet-2JHjVHI6.js") as Promise<SpreadsheetProtoModule>,
    loadWalnutAssemblyExports(),
  ]);
  return {
    kind: "spreadsheet" as const,
    proto: spreadsheetModule.Workbook.decode(walnutAssemblyExports.XlsxReader.ExtractXlsxProto(contentsBytes, false)),
  };
}

async function parsePptxPreviewProto(contentsBytes: Uint8Array) {
  const [presentationModule, walnutAssemblyExports] = await Promise.all([
    // @ts-ignore -- extracted upstream presentation bundle ships without declarations.
    import("../../assets/workbook/presentation-DaHxu2ui.js") as Promise<PresentationProtoModule>,
    loadWalnutAssemblyExports(),
  ]);
  return {
    kind: "presentation" as const,
    proto: presentationModule.Presentation.decode(
      walnutAssemblyExports.PptxReader.ExtractSlidesProto(contentsBytes, false),
    ),
  };
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

function getCachedArtifactProto(cacheKey: string, contentsBytes: Uint8Array) {
  const cachedEntry = parsedArtifactCache.get(cacheKey);
  if (cachedEntry == null || cachedEntry.contentsBytes.length !== contentsBytes.length) {
    return null;
  }

  for (let index = 0; index < contentsBytes.length; index += 1) {
    if (cachedEntry.contentsBytes[index] !== contentsBytes[index]) {
      return null;
    }
  }

  parsedArtifactCache.delete(cacheKey);
  parsedArtifactCache.set(cacheKey, cachedEntry);
  return cachedEntry.parsedArtifact;
}

function setCachedArtifactProto(cacheKey: string, contentsBytes: Uint8Array, parsedArtifact: ParsedArtifactPreview) {
  parsedArtifactCache.delete(cacheKey);
  parsedArtifactCache.set(cacheKey, { contentsBytes, parsedArtifact });

  while (parsedArtifactCache.size > MAX_PARSED_WORKBOOK_CACHE_ENTRIES) {
    const oldestCacheKey = parsedArtifactCache.keys().next().value;
    if (oldestCacheKey == null) {
      return;
    }
    parsedArtifactCache.delete(oldestCacheKey);
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
