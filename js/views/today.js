/* The Today screen. Date, greeting, an invitation, one clear way in. */

import { el, replace } from "../utils/dom.js";
import { go } from "../router.js";
import * as store from "../store.js";
import { invitationFor } from "../prompts.js";
import { excerpt, hashString } from "../utils/text.js";
import { longDate, greeting, todayKey, timeOfDay, plainDate, daysBetween } from "../utils/date.js";
import { saveACopy } from "../backup.js";

export function render() {
  const today = todayKey();
  const now = new Date();
  const todaysPages = store.entriesOn(today).filter(store.hasSubstance);

  const view = el("div.wrap.today.stagger", {}, [
    el("p.today__date", { text: longDate(today) }),
    el("h1.display.today__greeting", { text: greeting(now) }),
    el("p.today__invitation", { text: invitationFor(today) }),
    actions(todaysPages),
    rhythmLine(),
  ]);

  if (todaysPages.length) view.append(todaySection(todaysPages));

  const memory = remembrance(today);
  if (memory) view.append(memory);

  const notice = backupNotice();
  if (notice) view.append(notice);

  return view;
}

/**
 * A rare, quiet word about keeping a copy — never a notification, never a
 * streak, and never anything that implies your writing has gone anywhere.
 * It appears at the foot of the page and can be sent away for a month.
 */
function backupNotice() {
  const nudge = store.backupNudge();
  if (!nudge) return null;

  const block = el("aside.keepsafe");

  const draw = () => {
    replace(block,
      el("p.keepsafe__lead", {
        text: nudge.everSaved
          ? "It's been a while since you saved a copy of your journal."
          : `${nudge.pages} pages, and no copy saved yet.`,
      }),
      el("p.keepsafe__body", {
        text: "Your writing is yours and it stays on this device — saving a copy doesn't send it anywhere. It's a file, kept in case this browser is ever cleared.",
      }),
      el("div.keepsafe__actions", {}, [
        el("button.link", {
          type: "button",
          text: "Save a copy",
          onclick: async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = "Saving…";
            try {
              await saveACopy();
              replace(block, el("p.keepsafe__done", {
                text: "Saved to this device. Keep it somewhere you'd keep a photo album.",
              }));
            } catch (error) {
              button.disabled = false;
              button.textContent = "Save a copy";
            }
          },
        }),
        el("button.link.link--mute", {
          type: "button",
          text: "Not now",
          onclick: () => {
            store.snoozeBackupNotice();
            block.remove();
          },
        }),
      ])
    );
  };

  draw();
  return block;
}

function actions(todaysPages) {
  const primaryLabel = todaysPages.length ? "Begin another page" : "Begin writing";

  const row = el("div.today__action", {}, [
    el("button.btn", {
      type: "button",
      text: primaryLabel,
      onclick: () => go("/write"),
    }),
  ]);

  if (todaysPages.length === 1) {
    row.append(
      el("button.link.link--mute", {
        type: "button",
        text: "Continue today's page",
        onclick: () => go(`/write/${todaysPages[0].id}`),
      })
    );
  }

  return row;
}

function rhythmLine() {
  const { run, totalDays, sinceLast } = store.rhythm();

  let text;
  if (totalDays === 0) text = "Your first page is waiting.";
  else if (run > 1) text = `${run} days of writing.`;
  else if (sinceLast === 0) text = "You wrote today.";
  else if (sinceLast === 1) text = "You wrote yesterday.";
  else if (sinceLast <= 4) text = "It's been a little while. Whenever you're ready.";
  else if (sinceLast <= 21) text = "There's always room for another page.";
  else text = "Welcome back. Nothing has been lost.";

  return el("p.today__consistency", { text });
}

function todaySection(pages) {
  const list = el("ul.pagelist");
  for (const entry of pages) {
    list.append(
      el("li", {}, [
        el("button.pagelist__item", {
          type: "button",
          "aria-label": `Open the page written at ${timeOfDay(entry.createdAt)}`,
          onclick: () => go(`/entry/${entry.id}`),
        }, [
          el("span.pagelist__time", { text: timeOfDay(entry.createdAt) }),
          el("span.pagelist__text", {
            text: entry.content.trim() ? excerpt(entry.content, 140) : "A photograph.",
            dataset: { wordless: String(!entry.content.trim()) },
          }),
        ]),
      ])
    );
  }

  return el("section.section", {}, [
    el("h2.section__label", { text: pages.length === 1 ? "Today's page" : "Today's pages" }),
    list,
  ]);
}

/**
 * Two kinds of looking back, and never both at once:
 *   "On this day" when an entry shares today's date in an earlier year,
 *   otherwise an older page, surfaced only now and then.
 */
function remembrance(today) {
  // Both kinds of looking back quote a passage, so a wordless page can't be one.
  const anniversaries = store.onThisDay(today).filter((entry) => entry.content.trim());
  if (anniversaries.length) {
    const entry = anniversaries[0];
    const years = Number(today.slice(0, 4)) - Number(entry.date.slice(0, 4));
    return memoryBlock({
      label: `On this day, ${years === 1 ? "one year" : `${years} years`} ago`,
      entry,
      lead: null,
    });
  }

  const candidates = store.allEntries().filter(
    (entry) => entry.content.trim() && daysBetween(entry.date, today) >= 30
  );
  if (!candidates.length) return null;

  // Occasional, not daily — and steady for the whole of one day.
  if (hashString(`resurface:${today}`) % 3 !== 0) return null;

  const entry = candidates[hashString(`pick:${today}`) % candidates.length];
  return memoryBlock({
    label: "A thought from your past",
    entry,
    lead: "I remember writing this…",
  });
}

function memoryBlock({ label, entry, lead }) {
  return el("section.section", {}, [
    el("div.remember", {}, [
      el("p.remember__label", { text: label }),
      lead ? el("p.quiet.italic", { text: lead, style: { marginBottom: "0.5rem" } }) : null,
      el("blockquote.remember__quote", { text: `“${excerpt(entry.content, 220)}”` }),
      el("div.remember__meta", {}, [
        el("span.quiet.faint", { text: plainDate(entry.date) }),
        el("button.link", {
          type: "button",
          text: "Read the page",
          onclick: () => go(`/entry/${entry.id}`),
        }),
      ]),
    ]),
  ]);
}
