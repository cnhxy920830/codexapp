import { emit, listen } from "@tauri-apps/api/event";

export type QueryCacheInvalidateNotification = {
  queryKey: QueryCacheKey;
};

export type QueryCacheKey = readonly QueryCacheKeyPart[];

export type QueryCacheKeyPart =
  | string
  | number
  | boolean
  | null
  | QueryCacheKeyPart[]
  | QueryCacheKeyObject;

export type QueryCacheKeyObject = {
  [key: string]: QueryCacheKeyPart;
};

export function onQueryCacheInvalidated(
  handler: (notification: QueryCacheInvalidateNotification) => void,
) {
  return listen<QueryCacheInvalidateNotification>("query-cache-invalidate", (event) => {
    handler(event.payload);
  });
}

export async function emitQueryCacheInvalidated(queryKey: QueryCacheKey) {
  await emit<QueryCacheInvalidateNotification>("query-cache-invalidate", {
    queryKey: [...queryKey],
  });
}

export function queryKeyMatchesPrefix(
  queryKey: QueryCacheKey,
  prefix: QueryCacheKey,
) {
  if (queryKey.length < prefix.length) {
    return false;
  }

  const length = Math.min(queryKey.length, prefix.length);
  for (let index = 0; index < length; index += 1) {
    if (!queryCacheKeyPartEquals(queryKey[index], prefix[index])) {
      return false;
    }
  }

  return true;
}

function queryCacheKeyPartEquals(left: QueryCacheKeyPart, right: QueryCacheKeyPart): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => queryCacheKeyPartEquals(value, right[index] as QueryCacheKeyPart));
  }

  if (!isQueryCacheKeyObject(left) || !isQueryCacheKeyObject(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      queryCacheKeyPartEquals(left[key] as QueryCacheKeyPart, right[key] as QueryCacheKeyPart),
  );
}

function isQueryCacheKeyObject(value: QueryCacheKeyPart): value is QueryCacheKeyObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
