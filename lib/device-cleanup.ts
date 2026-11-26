// Everything one person leaves on a device that the next person must not see. Called from every sign-out path.
// Does not touch public/sw.js: it deletes the Cache API entries directly (and asks the worker to clear too, which is harmless).

/** Same key as HISTORY_KEY in components/TranslatePanel.tsx. */
const TRANSLATE_HISTORY_KEY = "le-nid-translations";

export async function clearDeviceData() {
  try { localStorage.removeItem(TRANSLATE_HISTORY_KEY); } catch { /* storage blocked */ }
  try { sessionStorage.removeItem(TRANSLATE_HISTORY_KEY); } catch { /* storage blocked */ }
  try { (await navigator.serviceWorker?.ready)?.active?.postMessage("clear"); } catch { /* no worker */ }
  try { await Promise.all((await caches.keys()).map((k) => caches.delete(k))); } catch { /* no Cache API */ }
}
