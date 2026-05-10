use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

const QUERY_CACHE_INVALIDATE_EVENT: &str = "query-cache-invalidate";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryCacheInvalidateNotification {
    query_key: Vec<Value>,
}

pub(crate) fn emit_query_cache_invalidate(app: &AppHandle, query_key: Vec<Value>) {
    let _ = app.emit(
        QUERY_CACHE_INVALIDATE_EVENT,
        QueryCacheInvalidateNotification { query_key },
    );
}
