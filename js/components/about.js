/* "About this journal" — the explanation someone needs when the link arrives
   from a friend and they have no idea what they're looking at.

   Written for a stranger, and deliberately honest about the limits: local-first
   means durable, not backed up, and there is no sync unless you do it. Anyone
   trusting an app with their private writing deserves to know that up front
   rather than discover it after losing something. */

import { el } from "../utils/dom.js";
import { durability } from "../store.js";

/* The published form address. The ?usp=publish-editor suffix Google appends
   when copying from the editor is dropped: it belongs to the editing session,
   not to the form a reader should be sent to. */
const FEEDBACK_FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSdz7K-5iGMKgRyqsgzaAn7TB92OAgCK337wV75bth7kFp3NKA/viewform";

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
      "Your writing is never uploaded. There is no account and no server holding your entries — the website hands over the app's files and nothing else. No one else can read what you write here, including whoever gave you the link.",
      "Storage is separate for each browser and each device. Safari, Chrome and the home-screen app each keep their own journal, even on the same phone.",
    ],
  },
  {
    title: "Keeping it safe",
    lines: () => {
      const lines = [
        "Local storage is durable, but it is not a backup. Clearing site data — or “Clear History and Website Data” — takes the journal with it, and nobody can recover it for you, because nobody else has it.",
      ];
      if (durability() === true) {
        lines.push("This browser has agreed to keep LUMEN's storage rather than clear it to reclaim space. That helps, but it does not survive you clearing site data yourself.");
      } else {
        lines.push("LUMEN asks the browser to keep its storage rather than clear it to reclaim space. Browsers decide for themselves, and adding LUMEN to your home screen makes a yes more likely.");
      }
      lines.push("Deleting a page happens immediately and cannot be undone.");
      return lines;
    },
  },
  {
    title: "Recommended backup schedule",
    lines: () => [
      "If you write most weeks: save a copy once a month. If you write occasionally: every few months is plenty.",
      "Always save one before changing phone or computer, before clearing your browser's data, and before deleting the app from your home screen.",
      "Keep the file where you keep things you would be sorry to lose — a cloud drive, or wherever your photographs go. It is an ordinary file on your device; saving it sends nothing anywhere.",
      "Every so often, if it has been a long while and there are new pages, LUMEN will show a quiet note at the foot of Today offering to save one. It appears two or three times a year at most, it can be sent away, and it is the only reminder there is — no emails, no notifications, nothing that reaches you outside the app.",
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
  {
    title: "Telling me what you think",
    lines: () => [
      "If something is broken, confusing, or missing, there is a short form for saying so. It asks for no name, no email and no account — whoever reads it has no way of knowing it came from you.",
      "It is the one thing in LUMEN that leads outside the app: the form is hosted by Google and opens in a new tab. Nothing from your journal is attached, and nothing is sent unless you type it there yourself. Please don't paste anything private into it.",
      el("p.about__text", {}, [
        el("a.about__link", {
          href: FEEDBACK_FORM,
          target: "_blank",
          rel: "noopener noreferrer",
          text: "Open the feedback form",
        }),
      ]),
    ],
  },
];

export function aboutGroup() {
  const group = el("div.sheet__group", {}, [
    el("p.sheet__label", { text: "About this journal" }),
    el("p.sheet__note.about__lead", {
      text: "Your writing belongs to you and stays on the device you wrote it on. There is no account, your pages are never uploaded, and nobody else — including whoever shared this link — can read a word of it. Saving a backup is only ever about making sure a cleared browser can't take it from you.",
    }),
  ]);

  for (const section of SECTIONS) {
    group.append(
      el("details.about__item", {}, [
        el("summary.about__summary", { text: section.title }),
        ...section.lines().map((line) =>
          line instanceof Node ? line : el("p.about__text", { text: line })
        ),
      ])
    );
  }

  return group;
}
