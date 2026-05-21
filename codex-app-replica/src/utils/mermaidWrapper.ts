import mermaid from "mermaid";

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

let isInitialized = false;

export const mermaidApi: MermaidRuntimeApi = {
  parse: async (source: string, options?: MermaidParseOptions) => {
    try {
      const result = await mermaid.parse(source, options);
      return result ? true : false;
    } catch {
      if (options?.suppressErrors) {
        return false;
      }
      throw new Error("Mermaid parse failed");
    }
  },
  render: async (diagramId: string, source: string) => {
    const result = await mermaid.render(diagramId, source);
    return { svg: result.svg };
  },
};

export function detectMermaidDiagramKind(source: string): string | null {
  const trimmed = source.trim();
  const firstLine = trimmed.split("\n")[0]?.trim().toLowerCase() || "";

  const diagramTypes: Record<string, string> = {
    "graph": "flowchart",
    "flowchart": "flowchart",
    "sequencediagram": "sequence",
    "classDiagram": "class",
    "stateDiagram": "state",
    "erDiagram": "er",
    "journey": "journey",
    "gantt": "gantt",
    "pie": "pie",
    "quadrantChart": "quadrant",
    "requirementDiagram": "requirement",
    "gitGraph": "git",
    "mindmap": "mindmap",
    "timeline": "timeline",
    "sankey-beta": "sankey",
    "xychart-beta": "xychart",
    "block-beta": "block",
    "packet-beta": "packet",
  };

  for (const [key, value] of Object.entries(diagramTypes)) {
    if (firstLine.startsWith(key.toLowerCase())) {
      return value;
    }
  }

  return null;
}

export function sanitizeMermaidSource(source: string): string | undefined {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

export function initializeMermaidRuntime(
  container: HTMLElement,
  isDark: boolean,
): MermaidRuntimeTheme {
  const theme = isDark ? "dark" : "default";

  if (!isInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "loose",
      fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
    });
    isInitialized = true;
  } else {
    mermaid.initialize({ theme });
  }

  return { theme };
}

export function applyMermaidSvgSizing(svg: SVGSVGElement, actualSize: boolean): void {
  if (actualSize) {
    svg.style.maxWidth = "none";
    svg.style.width = svg.getAttribute("width") || "auto";
    svg.style.height = svg.getAttribute("height") || "auto";
  } else {
    svg.style.maxWidth = "100%";
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.removeAttribute("width");
  }
}
