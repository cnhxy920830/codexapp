export type MarkdownFileLinkReference = {
  path: string;
  line: number | null;
  column: number | null;
};

export type MarkdownBrowserLinkHandlers = {
  onExternalLinkOpenInBrowser?: ((href: string) => void) | null;
  onFileLinkOpenInBrowser?: ((fileReference: MarkdownFileLinkReference) => void) | null;
};

export type MarkdownSidePanelFileLinkHandlers = {
  canFileLinkOpenInSidePanel?: ((fileReference: MarkdownFileLinkReference) => boolean) | null;
  onFileLinkOpen?: ((fileReference: MarkdownFileLinkReference) => void) | null;
};
