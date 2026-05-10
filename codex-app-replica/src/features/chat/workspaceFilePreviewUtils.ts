import { convertFileSrc } from "@tauri-apps/api/core";
import type { MessageKey } from "../../i18n/messages";
import type { WorkspaceFileDocument } from "../../services/workspaceFiles";

export type WorkspaceFilePreviewDescriptor = Pick<WorkspaceFileDocument, "name" | "path" | "relativePath"> & {
  mimeType: string | null;
};

export type WorkspaceFileUnsupportedPreviewKind =
  | "archive"
  | "audio"
  | "excelSpreadsheet"
  | "keynoteDeck"
  | "numbersSpreadsheet"
  | "opendocumentPresentation"
  | "opendocumentSpreadsheet"
  | "opendocumentText"
  | "pagesDocument"
  | "powerpointDeck"
  | "richTextDocument"
  | "video"
  | "wordDocument";

export type WorkspaceFilePreviewState =
  | {
      kind: "loading";
    }
  | {
      kind: "unsupported";
      unsupportedKind: WorkspaceFileUnsupportedPreviewKind;
    }
  | {
      kind: "ready";
      file: WorkspaceFileDocument;
    }
  | {
      kind: "tooLarge";
      sizeBytes: number;
    }
  | {
      kind: "error";
    };

export const WORKSPACE_FILE_PREVIEW_LIMIT_BYTES = 40 * 1024 * 1024;

export function normalizePreviewText(contents: string) {
  return contents.replace(/\r\n/g, "\n");
}

export function getSvgPreviewDataUri(file: WorkspaceFileDocument) {
  const contents = file.contents;
  if (!contents) {
    return null;
  }

  const normalizedMimeType = file.mimeType?.toLowerCase() ?? null;
  const normalizedRelativePath = file.relativePath.toLowerCase();
  const trimmedContents = contents.trimStart();

  if (
    normalizedMimeType !== "image/svg+xml" &&
    !normalizedRelativePath.endsWith(".svg") &&
    !trimmedContents.startsWith("<svg")
  ) {
    return null;
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(contents)}`;
}

export function getPdfPreviewSrc(file: WorkspaceFileDocument) {
  return convertFileSrc(file.path);
}

const ALWAYS_RICH_IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);

const MARKDOWN_EXTENSIONS = new Set(["markdown", "md", "mdown", "mdx", "mkd"]);

function getWorkspaceFileRichPreviewMode(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  if (extension === null) {
    return "none";
  }
  if (extension === "svg") {
    return "toggle";
  }
  if (ALWAYS_RICH_IMAGE_EXTENSIONS.has(extension)) {
    return "always";
  }
  return "none";
}

export function formatWorkspaceFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

const ARCHIVE_EXTENSIONS = new Set(["7z", "bz2", "gz", "rar", "tar", "tgz", "xz", "zip"]);
const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "alac",
  "flac",
  "m4a",
  "mid",
  "midi",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "wma",
]);
const EXCEL_EXTENSIONS = new Set(["xls", "xlsm", "xlsx"]);
const KEYNOTE_EXTENSIONS = new Set(["key"]);
const NUMBERS_EXTENSIONS = new Set(["numbers"]);
const OPEN_DOCUMENT_PRESENTATION_EXTENSIONS = new Set(["odp"]);
const OPEN_DOCUMENT_SPREADSHEET_EXTENSIONS = new Set(["ods"]);
const OPEN_DOCUMENT_TEXT_EXTENSIONS = new Set(["odt"]);
const PAGES_EXTENSIONS = new Set(["pages"]);
const POWERPOINT_EXTENSIONS = new Set(["ppt", "pptm", "pptx"]);
const RICH_TEXT_EXTENSIONS = new Set(["rtf"]);
const VIDEO_EXTENSIONS = new Set(["3g2", "3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv"]);
const WORD_EXTENSIONS = new Set(["doc", "docm", "docx"]);

export function getWorkspaceFileUnsupportedMessageKey(kind: WorkspaceFileUnsupportedPreviewKind): MessageKey {
  switch (kind) {
    case "archive":
      return "review.fileSource.unsupported.archive";
    case "audio":
      return "review.fileSource.unsupported.audio";
    case "excelSpreadsheet":
      return "review.fileSource.unsupported.excelSpreadsheet";
    case "keynoteDeck":
      return "review.fileSource.unsupported.keynoteDeck";
    case "numbersSpreadsheet":
      return "review.fileSource.unsupported.numbersSpreadsheet";
    case "opendocumentPresentation":
      return "review.fileSource.unsupported.opendocumentPresentation";
    case "opendocumentSpreadsheet":
      return "review.fileSource.unsupported.opendocumentSpreadsheet";
    case "opendocumentText":
      return "review.fileSource.unsupported.opendocumentText";
    case "pagesDocument":
      return "review.fileSource.unsupported.pagesDocument";
    case "powerpointDeck":
      return "review.fileSource.unsupported.powerpointDeck";
    case "richTextDocument":
      return "review.fileSource.unsupported.richTextDocument";
    case "video":
      return "review.fileSource.unsupported.video";
    case "wordDocument":
      return "review.fileSource.unsupported.wordDocument";
  }
}

export function getWorkspaceFileUnsupportedPreviewKind(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  const mimeType = file.mimeType?.toLowerCase() ?? null;

  if (
    ARCHIVE_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/zip" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/gzip" ||
    mimeType === "application/x-bzip" ||
    mimeType === "application/x-bzip2" ||
    mimeType === "application/x-xz"
  ) {
    return "archive";
  }
  if (AUDIO_EXTENSIONS.has(extension ?? "") || (mimeType?.startsWith("audio/") ?? false)) {
    return "audio";
  }
  if (
    EXCEL_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel.sheet.macroenabled.12"
  ) {
    return "excelSpreadsheet";
  }
  if (KEYNOTE_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.apple.keynote") {
    return "keynoteDeck";
  }
  if (NUMBERS_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.apple.numbers") {
    return "numbersSpreadsheet";
  }
  if (
    OPEN_DOCUMENT_PRESENTATION_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.oasis.opendocument.presentation"
  ) {
    return "opendocumentPresentation";
  }
  if (
    OPEN_DOCUMENT_SPREADSHEET_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    return "opendocumentSpreadsheet";
  }
  if (OPEN_DOCUMENT_TEXT_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.oasis.opendocument.text") {
    return "opendocumentText";
  }
  if (PAGES_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.apple.pages") {
    return "pagesDocument";
  }
  if (
    POWERPOINT_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "powerpointDeck";
  }
  if (RICH_TEXT_EXTENSIONS.has(extension ?? "") || mimeType === "application/rtf" || mimeType === "text/rtf") {
    return "richTextDocument";
  }
  if (VIDEO_EXTENSIONS.has(extension ?? "") || (mimeType?.startsWith("video/") ?? false)) {
    return "video";
  }
  if (
    WORD_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "wordDocument";
  }

  return null;
}

export function getWorkspaceFileRichPreviewKind(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  const richPreviewMode = getWorkspaceFileRichPreviewMode(file);
  if (richPreviewMode !== "none") {
    return "image";
  }
  if (extension !== null && MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }
  if (extension === "pdf") {
    return "pdf";
  }
  return null;
}

export function isWorkspaceFilePdbPreview(file: WorkspaceFilePreviewDescriptor) {
  return getWorkspaceFileExtension(file) === "pdb";
}

export function getWorkspaceFileRichPreviewControlMode(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  const richPreviewMode = getWorkspaceFileRichPreviewMode(file);
  if (richPreviewMode === "always") {
    return "always";
  }
  if (richPreviewMode === "toggle" || (extension !== null && MARKDOWN_EXTENSIONS.has(extension))) {
    return "toggle";
  }
  if (extension === "pdf") {
    return "always";
  }
  return "none";
}

function getWorkspaceFileExtension(file: WorkspaceFilePreviewDescriptor) {
  const normalizedPath = (file.relativePath || file.name || file.path).toLowerCase();
  const extensionStartIndex = normalizedPath.lastIndexOf(".");
  if (extensionStartIndex <= -1 || extensionStartIndex === normalizedPath.length - 1) {
    return null;
  }
  return normalizedPath.slice(extensionStartIndex + 1);
}

export function getBreadcrumbSegments(path: string) {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0);
}
