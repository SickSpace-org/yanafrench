"use client";

import { useEffect } from "react";

// Cache-Control: no-store (see proxy.ts) stops an HTTP/CDN cache from
// re-serving a stale protected page, but the browser's own back/forward
// cache is separate — bfcache restores the page from an in-memory
// snapshot with no network request at all, so the server guard never
// gets a chance to re-run. Reloading whenever a page is shown "persisted"
// (restored from bfcache) forces a real request, which hits proxy.ts
// again and bounces a since-logged-out student to /login.
export function BfcacheGuard() {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
