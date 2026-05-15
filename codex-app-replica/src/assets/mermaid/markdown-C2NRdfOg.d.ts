export type MermaidRuntimeTheme = {
  theme?: string | null;
};

export type MermaidRenderResult = {
  svg: string;
};

export type MermaidParseOptions = {
  suppressErrors?: boolean;
};

export type MermaidRuntimeApi = {
  parse: (source: string, options?: MermaidParseOptions) => Promise<boolean> | boolean;
  render: (diagramId: string, source: string) => Promise<MermaidRenderResult>;
};

export const mermaidApi: MermaidRuntimeApi;
export const detectMermaidDiagramKind: (source: string) => string | null;
export const sanitizeMermaidSource: (source: string) => string | undefined;
export const initializeMermaidRuntime: (container: HTMLElement, isDark: boolean) => MermaidRuntimeTheme;
export const applyMermaidSvgSizing: (svg: SVGSVGElement, actualSize: boolean) => void;
