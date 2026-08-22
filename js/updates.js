/* Noticing that a newer version has arrived.

   Worth being precise about when this matters. LUMEN's service worker is
   network-first, so *launching* the app while online already loads the current
   version — there is no stale build to clear. What it cannot do is change the
   code of a page that is already open, which is exactly the case for an app
   left running, or one installed to a home screen and resumed from the
   background rather than launched fresh.

   Detection leans on the browser's own update machinery: when it finds a newer
   service worker and that worker takes control, we know the files on disk have
   moved on. No version is polled, and nothing about you is sent anywhere. */

const RECHECK_AFTER = 30 * 60 * 1000;

export function watchForUpdates(onNewVersionReady) {
  if (!("serviceWorker" in navigator)) return;

  // No controller yet means this is a first registration, not an update.
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    onNewVersionReady();
  });

  /* Ask the browser to re-check when the app is brought back into view. It
     re-reads sw.js — one small same-origin file, carrying nothing — which is
     what makes the notice timely for an installed app that is resumed rather
     than relaunched. Throttled, so returning to the app repeatedly is free. */
  let lastCheck = Date.now();
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastCheck < RECHECK_AFTER) return;
    lastCheck = Date.now();
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    } catch (error) {
      // An update check that fails costs nothing; the app carries on.
    }
  });
}
