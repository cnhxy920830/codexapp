import { invoke } from "@tauri-apps/api/core";

export type ConnectorPersonalizationMode =
  | "NO_PERSONALIZATION"
  | "PERSONALIZE_ALWAYS";

export type AppConnectorDisclosureBlurb = {
  description: string;
  title: string;
};

export type AppConnectorPersonalizationToggle = {
  appId: string;
  appName: string;
  blurb: AppConnectorDisclosureBlurb;
  defaultMode: string;
};

export type ReadAppConnectorDisclosureParams = {
  appId: string;
  appName: string;
};

export type ReadAppConnectorDisclosureResponse = {
  blurbs: AppConnectorDisclosureBlurb[];
  personalizationToggle: AppConnectorPersonalizationToggle | null;
};

export type ConnectAppConnectorCallbackMode = "browser" | "native";

export type ConnectAppConnectorParams = {
  appId: string;
  appName: string;
  callbackMode?: ConnectAppConnectorCallbackMode;
  installUrl?: string | null;
  personalizationMode?: ConnectorPersonalizationMode | null;
};

export type ConnectAppConnectorResponse =
  | {
      kind: "browser-fallback";
    }
  | {
      kind: "connected-directly";
    }
  | {
      kind: "failed";
    }
  | {
      kind: "oauth-started";
      redirectUrl: string;
    };

export async function readAppConnectorDisclosure(
  params: ReadAppConnectorDisclosureParams,
) {
  return invoke<ReadAppConnectorDisclosureResponse>(
    "read-app-connector-disclosure",
    {
      params,
    },
  );
}

export async function connectAppConnector(params: ConnectAppConnectorParams) {
  return invoke<ConnectAppConnectorResponse>("connect-app-connector", {
    params,
  });
}
