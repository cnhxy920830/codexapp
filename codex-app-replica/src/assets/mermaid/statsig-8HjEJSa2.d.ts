export type StatsigEventMetadata = Record<string, string>;

export type StatsigUserLike = Record<string, unknown>;

export type StatsigClientLike = {
  getContext(): {
    user?: Record<string, unknown>;
  };
  initializeAsync(): Promise<unknown>;
  logEvent(
    eventName: string,
    value?: number | string | null,
    metadata?: StatsigEventMetadata,
  ): void;
};

export type StatsigModule = {
  StatsigClient: new (
    sdkKey: string,
    user: StatsigUserLike,
    options?: {
      networkConfig?: {
        api?: string;
        logEventUrl?: string;
        networkOverrideFunc?: (
          input: string | URL,
          init?: RequestInit,
        ) => Promise<Response>;
        sdkExceptionUrl?: string;
      };
    } | null,
  ) => StatsigClientLike;
};

export const f: StatsigModule;
