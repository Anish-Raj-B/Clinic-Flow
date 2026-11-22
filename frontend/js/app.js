/**
 * Application bootstrap. Wires theme, authentication and the router together.
 */

import { initAuth, subscribeAuth } from "./store.js";
import { startRouter } from "./router.js";

async function boot() {
  startRouter();
  await initAuth();

  let queued = false;
  subscribeAuth(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });

  // If the first render ran before the session was restored, refresh it now.
  window.dispatchEvent(new PopStateEvent("popstate"));
}

void boot();
