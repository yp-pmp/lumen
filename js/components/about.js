/* "About this journal" — the explanation someone needs when the link arrives
   from a friend and they have no idea what they're looking at.

   Written for a stranger, and deliberately honest about the limits: local-first
   means durable, not backed up, and there is no sync unless you do it. Anyone
   trusting an app with their private writing deserves to know that up front
   rather than discover it after losing something. */

import { el } from "../utils/dom.js";

/** Already launched from a home screen or dock? Then the advice is moot. */
function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.navigator.standalone === true
  );
}

const SECTIONS = [
  {
    title: "The best way to open it",
    lines: () => isInstalled()
      ? [
          "You're already running LUMEN from your home screen, which is the right way to use it — it opens full screen, and its writing is kept safest this way.",
        ]
      : [
          "On iPhone or iPad, open it in Safari and choose Share → Add to Home Screen. On Android, Chrome's menu offers Add to Home screen. On a computer, a bookmark is fine.",
          "This is worth doing rather than skipping. iOS clears a website's stored data after seven days without a visit — but apps added to the home screen are exempt from that, so this is how your writing stays put.",
        ],
  },
  {
    title: "Where your writing lives",
    lines: () => [
      "Everything you write, and every photograph you add, is stored by the browser on the device you wrote it on.",
      "Nothing is uploaded. There is no account and no server holding your entries — the website hands over the app's files and nothing else. No one else can read what you write here, including whoever gave you the link.",
      "Storage is separate for each browser and each device. Safari, Chrome and the home-screen app each keep their own journal, even on the same phone.",
    ],
  },
  {
    title: "Keeping it safe",
    lines: () => [
      "Local storage is durable, but it is not a backup. Clearing site data — or “Clear History and Website Data” — takes the journal with it.",
      "Use Export everything now and then and keep the file somewhere you trust. It contains your pages and photographs, so treat it as private.",
      "Deleting a page happens immediately and cannot be undone.",
    ],
  },
  {
    title: "Using it on two devices",
    lines: () => [
      "Each device keeps its own journal. There is no automatic syncing.",
      "To bring them together: Export everything on one, then Bring in a backup on the other. It is safe to do in either direction, as often as you like — pages already there are left alone.",
      "Where both devices have the same page, the more recently edited version wins, and a page deleted on one is deleted on the other. The one thing to avoid is editing the same page on both devices before reconciling them, which loses one of the two edits.",
    ],
  },
  {
    title: "Offline, and updates",
    lines: () => [
      "After the first visit the app itself is kept on your device, so it opens with no connection at all. Writing, searching and everything else already happened locally.",
      "When you are online it loads the current version, so improvements arrive on their own the next time you open it. Your pages are never affected by an update.",
    ],
  },
];

export function aboutGroup() {
  const group = el("div.sheet__group", {}, [
    el("p.sheet__label", { text: "About this journal" }),
    el("p.sheet__note.about__lead", {
      text: "LUMEN keeps everything on the device you write it on. There is no account, and nothing is ever uploaded.",
    }),
  ]);

  for (const section of SECTIONS) {
    group.append(
      el("details.about__item", {}, [
        el("summary.about__summary", { text: section.title }),
        ...section.lines().map((line) => el("p.about__text", { text: line })),
      ])
    );
  }

  return group;
}
