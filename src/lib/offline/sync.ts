/**
 * Background Sync registration.
 * Resolves true if a sync was registered with the SW (browser will replay
 * sj-flush-complaints when connectivity returns, even if the tab is closed).
 * Returns false on Safari / unsupported browsers — the OfflineProvider
 * `online` event listener remains as the fallback path.
 */
export async function registerBackgroundSync(tag = "sj-flush-complaints"): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    // SyncManager is not in TS lib by default.
    const sync = (reg as unknown as { sync?: { register: (t: string) => Promise<void> } }).sync;
    if (!sync) return false;
    await sync.register(tag);
    return true;
  } catch {
    return false;
  }
}
