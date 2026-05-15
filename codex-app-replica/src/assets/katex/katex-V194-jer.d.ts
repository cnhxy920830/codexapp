export type KatexRenderOptions = {
  displayMode?: boolean;
  errorColor?: string;
  strict?: boolean | "ignore" | string;
  throwOnError?: boolean;
};

export const c: {
  renderToString(expression: string, options?: KatexRenderOptions): string;
};
