import { invoke } from "@tauri-apps/api/core";

type StatsigRequestParams = {
  bodyBase64: string | null;
  headers: Record<string, string>;
  method: string;
  url: string;
};

type StatsigRequestResponse = {
  bodyBase64: string;
  headers: Record<string, string>;
  status: number;
};

export async function statsigFetchThroughTauri(
  input: string | URL,
  init: RequestInit = {},
) {
  if (init.signal?.aborted) {
    throw createAbortError();
  }

  const headers = new Headers(init.headers);
  const bodyBase64 = await encodeRequestBody(init.body, headers);
  const response = await invoke<StatsigRequestResponse>("statsig-request", {
    params: {
      bodyBase64,
      headers: Object.fromEntries(headers.entries()),
      method: init.method ?? "GET",
      url: String(input),
    } satisfies StatsigRequestParams,
  });

  if (init.signal?.aborted) {
    throw createAbortError();
  }

  return new Response(decodeBase64(response.bodyBase64), {
    headers: response.headers,
    status: response.status,
  });
}

async function encodeRequestBody(
  body: BodyInit | null | undefined,
  headers: Headers,
) {
  if (body == null) {
    return null;
  }

  if (typeof body === "string") {
    setDefaultContentType(headers, "text/plain;charset=UTF-8");
    return encodeBase64(new TextEncoder().encode(body));
  }

  if (body instanceof URLSearchParams) {
    setDefaultContentType(
      headers,
      "application/x-www-form-urlencoded;charset=UTF-8",
    );
    return encodeBase64(new TextEncoder().encode(body.toString()));
  }

  if (body instanceof Blob) {
    if (body.type.length > 0) {
      setDefaultContentType(headers, body.type);
    }
    return encodeBase64(new Uint8Array(await body.arrayBuffer()));
  }

  if (body instanceof ArrayBuffer) {
    return encodeBase64(new Uint8Array(body));
  }

  if (ArrayBuffer.isView(body)) {
    return encodeBase64(
      new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
    );
  }

  throw new Error("Unsupported Statsig request body");
}

function setDefaultContentType(headers: Headers, value: string) {
  if (!headers.has("content-type")) {
    headers.set("content-type", value);
  }
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

function decodeBase64(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createAbortError() {
  return typeof DOMException === "function"
    ? new DOMException("The operation was aborted.", "AbortError")
    : new Error("The operation was aborted.");
}
