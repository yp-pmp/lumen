/* ==========================================================================
   LUMEN — application shell
   Mounts views, keeps the masthead honest, and sets the tone of the light.
   ========================================================================== */

import { el, icon, clear, prefersReducedMotion } from "./utils/dom.js";
import * as router from "./router.js";
import * as store from "./store.js";
import { openSettings } from "./components/settings.js";
import { onboarding } from "./views/onboarding.js";
import * as today from "./views/today.js";
import * as editor from "./views/editor.js";
import * as journal from "./views/journal.js";
import * as entryView from "./views/entry.js";
import * as reflections from "./views/reflections.js";
import { partOfDay } from "./utils/date.js";
import * as media from "./media.js";
import { watchForUpdates } from "./updates.js";

const VIEWS = {
  today: today.render,
  write: editor.render,
  journal: journal.render,
  entry: entryView.render,
  reflections: reflections.render,
  month: reflections.renderMonth,
};

const NAV = [
  { name: "today", path: "/", label: "Today" },
  { name: "journal", path: "/journal", label: "Journal" },
  { name: "reflections", path: "/reflections", label: "Reflections" },
];

const NAV_FOR = { today: "today", write: "today", journal: "journal", entry: "journal", reflections: "reflections", month: "reflections" };

const viewRoot = document.getElementById("view");
const masthead = document.getElementById("masthead");

let currentRoute = null;
let firstPaint = true;

/* --- appearance ----------------------------------------------------------- */

function applyTheme() {
  document.documentElement.dataset.theme = store.getSettings().theme || "auto";
}

function applyTimeOfDay() {
  document.documentElement.dataset.tod = partOfDay();
}

/* --- masthead ------------------------------------------------------------- */

function drawMasthead(route) {
  // The editor keeps its own quiet chrome.
  masthead.hidden = route.name === "write";
  if (masthead.hidden) return;

  const active = NAV_FOR[route.name];
  const nav = el("nav.nav", { "aria-label": "Sections" });

  for (const item of NAV) {
    nav.append(
      el("a.nav__link", {
        href: router.href(item.path),
        text: item.label,
        "aria-current": active === item.name ? "page" : null,
        onclick: () => {
          if (item.name === "journal" && active !== "journal") journal.resetFilters();
        },
      })
    );
  }

  clear(masthead).append(
    el("a.wordmark", { href: router.href("/"), text: "Lumen" }),
    nav,
    el("div.masthead__aside", {}, [
      el("button.glyph-btn", {
        type: "button",
        "aria-label": "Settings",
        title: "Settings",
        onclick: () => openSettings({ onChange: () => { applyTheme(); mount(currentRoute, { animate: false }); } }),
      }, [icon("settings")]),
    ])
  );
}

/* --- mounting ------------------------------------------------------------- */

function mount(route, { animate = true } = {}) {
  currentRoute = route;

  // Let the outgoing view flush anything it was holding (an unsaved keystroke).
  viewRoot.firstElementChild?.dispatchEvent(new CustomEvent("lumen:teardown"));

  drawMasthead(route);

  const build = VIEWS[route.name] || VIEWS.today;
  const node = build(route);

  clear(viewRoot).append(node);

  if (animate && !prefersReducedMotion() && route.name !== "write") {
    node.classList.add("enter-soft");
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  // Held back while writing; offered as soon as the page is left.
  if (route.name !== "write") showUpdateNotice();

  // On a route change, move focus to the new view so a keyboard or screen
  // reader lands in the right place. Never on first paint: focus belongs at
  // the top of the document then, where the skip link is.
  if (!firstPaint && route.name !== "write") viewRoot.focus({ preventScroll: true });
  firstPaint = false;

  document.title = titleFor(route);
}

function titleFor(route) {
  switch (route.name) {
    case "write": return "Writing — LUMEN";
    case "journal": return "Journal — LUMEN";
    case "entry": return "A page — LUMEN";
    case "reflections":
    case "month": return "Reflections — LUMEN";
    default: return "LUMEN";
  }
}

/**
 * If the browser will not let us keep anything — a private window, or storage
 * turned off — say so plainly before someone trusts the app with a page.
 */
function warnAboutStorage() {
  document.body.prepend(
    el("p.storage-warning", {
      role: "alert",
      text: "This browser won't let LUMEN save anything, so nothing written here will survive a reload. A private window is the usual cause.",
    })
  );
}

/**
 * Offline support, if the browser offers it. Registration is deliberately
 * silent and failure-tolerant: LUMEN works perfectly well without it, and a
 * blocked or unsupported service worker should never cost you a page.
 */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/**
 * A newer version has taken over in the background. Say so once, quietly, and
 * let the reader choose the moment — never mid-sentence, and never by
 * reloading the page out from under them.
 */
let updateWaiting = false;

function noteUpdateReady() {
  updateWaiting = true;
  showUpdateNotice();
}

function showUpdateNotice() {
  if (!updateWaiting) return;
  if (currentRoute?.name === "write") return;        // not while writing
  if (document.getElementById("update-notice")) return;

  const notice = el("div.update-notice", { id: "update-notice", role: "status" }, [
    el("p.update-notice__text", { text: "A newer version of LUMEN is ready." }),
    el("div.update-notice__actions", {}, [
      el("button.link", { type: "button", text: "Reload", onclick: () => window.location.reload() }),
      el("button.link.link--mute", {
        type: "button",
        text: "Later",
        onclick: () => {
          updateWaiting = false;
          notice.remove();
        },
      }),
    ]),
  ]);
  document.getElementById("overlay-root").append(notice);
}

/* --- start ---------------------------------------------------------------- */

function begin() {
  store.load();
  applyTheme();
  applyTimeOfDay();

  // Keep the light honest across a long session.
  setInterval(applyTimeOfDay, 5 * 60 * 1000);

  // A second tab wrote something. Catch up — unless this tab is mid-sentence,
  // in which case redrawing would throw the writing away.
  store.subscribeExternal(() => {
    applyTheme();
    if (currentRoute && currentRoute.name !== "write") mount(currentRoute, { animate: false });
  });

  if (!store.isPersistent()) warnAboutStorage();
  registerServiceWorker();
  watchForUpdates(noteUpdateReady);

  // Pictures left behind by a page deleted in another tab, or replaced by an
  // import. Harmless if it fails; it only reclaims space.
  media.pruneOrphans(store.referencedImages()).catch(() => {});

  // Ask the browser not to evict this journal under storage pressure. Only
  // once there is something to protect, so a first-time visitor is never
  // asked on behalf of an empty journal.
  if (store.allEntries().some(store.hasSubstance)) {
    store.requestDurableStorage().catch(() => {});
  }

  const settings = store.getSettings();
  if (!settings.onboarded) {
    // Nothing behind the introduction should be reachable by tab or by
    // a screen reader while it is open — including the skip link.
    const behind = [document.querySelector(".skip-link"), masthead, viewRoot].filter(Boolean);
    for (const node of behind) node.inert = true;

    document.getElementById("overlay-root").append(
      onboarding({
        onFinish: (reason) => {
          for (const node of behind) node.inert = false;
          store.updateSettings({ onboarded: true });
          if (reason === "begin") router.go("/write");
        },
      })
    );
  }

  router.start((route) => mount(route));
}

begin();
