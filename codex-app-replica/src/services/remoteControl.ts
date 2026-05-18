import { invoke } from "@tauri-apps/api/core";

export type RemoteControlMfaRequirementResponse = {
  requirement: string;
};

export type MfaInfoResponse = {
  mfaEnabledV2: boolean;
};

export type RemoteControlMfaRequiredButDisabledResponse = {
  mfaRequiredButDisabled: boolean;
};

export type RemoteControlClientsListParams = {
  cursor?: string | null;
  limit?: number | null;
};

export type RemoteControlClient = {
  client_id: string;
  display_name: string | null;
  device_model: string | null;
  platform: string | null;
  status: string | null;
  enrollment_status: string | null;
  created_at: string | null;
  last_seen_at: string | null;
};

export type RemoteControlClientsListResponse = {
  items: RemoteControlClient[];
  cursor: string | null;
};

const DEFAULT_REMOTE_CONTROL_CLIENTS_PAGE_SIZE = 100;
const PENDING_ENROLLMENT_STATUS = "pending_enrollment";

export async function readRemoteControlMfaRequirement() {
  return invoke<RemoteControlMfaRequirementResponse>("remote-control-mfa-requirement-read");
}

export async function readMfaInfo() {
  return invoke<MfaInfoResponse>("mfa-info-read");
}

export async function readRemoteControlMfaRequiredButDisabled() {
  return invoke<RemoteControlMfaRequiredButDisabledResponse>(
    "remote-control-mfa-required-but-disabled-read",
  );
}

export async function listRemoteControlClients(
  params: RemoteControlClientsListParams = {},
) {
  const { cursor = null, limit = DEFAULT_REMOTE_CONTROL_CLIENTS_PAGE_SIZE } = params;
  return invoke<RemoteControlClientsListResponse>("remote-control-clients-list", {
    params: {
      cursor,
      limit,
    },
  });
}

export function isConnectedRemoteControlClient(client: RemoteControlClient) {
  return client.enrollment_status !== PENDING_ENROLLMENT_STATUS;
}

export async function listConnectedRemoteControlClients(cursor: string | null = null): Promise<RemoteControlClient[]> {
  const response = await listRemoteControlClients({
    cursor,
    limit: DEFAULT_REMOTE_CONTROL_CLIENTS_PAGE_SIZE,
  });
  const connectedClients = response.items.filter(isConnectedRemoteControlClient);
  if (response.cursor == null) {
    return connectedClients;
  }
  return connectedClients.concat(await listConnectedRemoteControlClients(response.cursor));
}

export async function hasConnectedRemoteControlClients(cursor: string | null = null): Promise<boolean> {
  const response = await listRemoteControlClients({
    cursor,
    limit: DEFAULT_REMOTE_CONTROL_CLIENTS_PAGE_SIZE,
  });
  if (response.items.some(isConnectedRemoteControlClient)) {
    return true;
  }
  return response.cursor == null ? false : hasConnectedRemoteControlClients(response.cursor);
}
