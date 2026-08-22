/* The archive — a personal library, laid out as a timeline. */

import { el, icon, debounce, replace, announce } from "../utils/dom.js";
import { go } from "../router.js";
import * as store from "../store.js";
import { calendar } from "../components/calendar.js";
import { excerpt, matchWindow, readingTime } from "../utils/text.js";
import { longDate, monthTitle, monthKey, todayKey, plainDate, timeOfDay } from "../utils/date.js";

/* Filters live between visits, so coming back to the archive feels
   like returning to the shelf you left open. */
const filters = { query: "", mood: "", month: "", date: "" };
let visibleMonth = todayKey().slice(0, 7);

export function render() {
  const all = store.allEntries().filter(store.hasSubstance);

  if (!all.length) return emptyLibrary();

  const results = el("div.timeline");
  const note = el("p.results-note", { role: "status", "aria-live": "polite" });
  const calendarSlot = el("div");

  const searchInput = el("input.search__input", {
    type: "search",
    value: filters.query,
    placeholder: "Search your pages",
    "aria-label": "Search your pages",
    autocomplete: "off",
  });

  const runSearch = debounce(() => {
    filters.query = searchInput.value;
    draw();
  }, 160);
  searchInput.addEventListener("input", runSearch);
  searchInput.addEventListener("search", () => {
    filters.query = searchInput.value;
    draw();
  });

  const moodSelect = select({
    label: "Any mood",
    value: filters.mood,
    options: store.moodList().map((mood) => ({ value: mood, label: mood })),
    onchange: (value) => {
      filters.mood = value;
      draw();
    },
    ariaLabel: "Filter by mood",
  });

  const months = store.monthsWithEntries();
  const monthSelect = select({
    label: "All time",
    value: filters.month,
    options: months.map(({ ym }) => ({ value: ym, label: monthTitle(ym) })),
    onchange: (value) => {
      filters.month = value;
      filters.date = "";
      if (value) visibleMonth = value;
      draw();
    },
    ariaLabel: "Filter by month",
  });

  const clearButton = el("button.link.link--mute", {
    type: "button",
    text: "Clear",
    hidden: true,
    onclick: () => {
      filters.query = "";
      filters.mood = "";
      filters.month = "";
      filters.date = "";
      searchInput.value = "";
      moodSelect.value = "";
      monthSelect.value = "";
      draw();
      searchInput.focus();
    },
  });

  const view = el("div.wrap", {}, [
    el("h1.sr-only", { text: "Journal" }),
    el("div.search", {}, [icon("search"), searchInput]),
    el("div.filters", {}, [monthSelect, moodSelect, clearButton]),
    calendarSlot,
    note,
    results,
  ]);

  /* The month map is a way of wandering. While you are searching for
     something specific it only stands between you and the results. */
  function drawCalendar() {
    if (filters.query) {
      calendarSlot.replaceChildren();
      return;
    }

    const counts = new Map();
    for (const entry of all) counts.set(entry.date, (counts.get(entry.date) || 0) + 1);

    replace(calendarSlot,
      calendar({
        month: visibleMonth,
        counts,
        selected: filters.date,
        earliest: monthKey(all[all.length - 1].date),
        onMonth: (ym) => {
          visibleMonth = ym;
          drawCalendar();
        },
        onDay: (key) => {
          const onThatDay = store.entriesOn(key).filter(store.hasSubstance);
          if (onThatDay.length === 1) {
            go(`/entry/${onThatDay[0].id}`);
            return;
          }
          filters.date = filters.date === key ? "" : key;
          filters.month = "";
          monthSelect.value = "";
          draw();
        },
      })
    );
  }

  function draw() {
    const found = store.search(filters.query, {
      mood: filters.mood,
      month: filters.month,
      date: filters.date,
    });

    const active = filters.query || filters.mood || filters.month || filters.date;
    clearButton.hidden = !active;
    moodSelect.dataset.active = String(Boolean(filters.mood));
    monthSelect.dataset.active = String(Boolean(filters.month));

    drawCalendar();
    note.textContent = describe(found.length, active, filters);

    results.replaceChildren();
    if (!found.length) {
      results.append(noMatches(() => clearButton.click()));
      return;
    }

    let lastMonth = null;
    let lastDate = null;
    for (const entry of found) {
      const ym = monthKey(entry.date);
      if (ym !== lastMonth) {
        lastMonth = ym;
        lastDate = null;
        results.append(el("h2.timeline__month", { text: monthTitle(ym) }));
      }
      // Several pages on one day: name the day once, then the hour.
      results.append(entryCard(entry, filters.query, entry.date !== lastDate));
      lastDate = entry.date;
    }
  }

  draw();
  return view;
}

function describe(count, active, current) {
  if (!active) return "";
  const noun = count === 1 ? "page" : "pages";
  if (current.date) {
    return count
      ? `${count} ${noun} on ${plainDate(current.date)}.`
      : `Nothing on ${plainDate(current.date)}.`;
  }
  return count ? `${count} ${noun}.` : "Nothing here yet.";
}

/**
 * A page in the archive.
 *
 * The card is an <article> rather than a button, because it holds two separate
 * controls: opening the page, and marking it as a milestone. Nesting one button
 * inside another is invalid and unusable by keyboard, so the "open" button
 * stretches to cover the card via a pseudo-element and the milestone ring sits
 * above it.
 */
function entryCard(entry, query, showDate = true) {
  const card = el("article.entry-card", { dataset: { marked: String(Boolean(entry.milestone)) } });

  const open = el("button.entry-card__open", {
    type: "button",
    "aria-label": `Open the page from ${longDate(entry.date, { withYear: true })}, ${timeOfDay(entry.createdAt)}`,
    onclick: () => go(`/entry/${entry.id}`),
  });

  const meta = el("div.entry-card__meta", {}, [
    el("span.entry-card__date", {
      text: showDate ? longDate(entry.date, { withYear: true }) : timeOfDay(entry.createdAt),
      dataset: { later: String(!showDate) },
    }),
  ]);
  if (entry.mood) {
    meta.append(
      el("span.entry-card__dot", { text: "·", "aria-hidden": "true" }),
      el("span.entry-card__mood", { text: entry.mood })
    );
  }
  if (entry.wordCount) {
    meta.append(
      el("span.entry-card__dot", { text: "·", "aria-hidden": "true" }),
      el("span.entry-card__read", { text: readingTime(entry.wordCount) })
    );
  }
  if (entry.images?.length) {
    const count = entry.images.length;
    meta.append(
      el("span.entry-card__dot", { text: "·", "aria-hidden": "true" }),
      el("span.entry-card__photos", { text: count === 1 ? "1 photograph" : `${count} photographs` })
    );
  }
  card.append(meta);

  if (entry.milestone) {
    open.append(
      el("p.entry-card__milestone", {}, [
        el("span.milestone__mark", { text: "Milestone", "aria-hidden": "true" }),
        el("span", { text: entry.milestone }),
      ])
    );
  }

  if (entry.prompt) open.append(el("p.entry-card__prompt", { text: entry.prompt }));

  if (entry.content.trim()) {
    open.append(el("p.entry-card__excerpt", {}, snippet(entry.content, query)));
  } else {
    open.append(el("p.entry-card__excerpt.italic", { text: "A page with no words on it." }));
  }

  /* Spelled out rather than drawn. A bare ring gave no clue what it did, and
     a tooltip is no help on a phone. It rides at the end of the metadata line
     where the eye already goes for the small print. */
  const mark = el("button.entry-card__mark", {
    type: "button",
    text: entry.milestone ? "Change the milestone" : "Mark as a milestone",
    "aria-label": entry.milestone
      ? `Change the milestone on the page from ${longDate(entry.date, { withYear: true })}`
      : `Mark the page from ${longDate(entry.date, { withYear: true })} as a milestone`,
    onclick: () => askForLabel(),
  });
  meta.append(el("span.entry-card__dot", { text: "·", "aria-hidden": "true" }), mark);

  card.append(open);

  /* Marking without leaving the archive: the label is asked for right here,
     since a milestone is nothing without a few words to name it. */
  function askForLabel() {
    if (card.querySelector(".entry-card__naming")) return;

    const input = el("input.milestone__input", {
      type: "text",
      value: entry.milestone || "",
      maxlength: String(store.milestoneLimit()),
      placeholder: "In a few words — what happened?",
      "aria-label": "What made this day a milestone?",
    });

    const commit = (value) => {
      const fresh = store.getEntry(entry.id);
      if (!fresh) return;
      fresh.milestone = value.trim() || null;
      const saved = store.saveEntry(fresh);
      announce(saved.milestone ? "Marked as a milestone" : "Milestone removed");
      card.replaceWith(entryCard(saved, query, showDate));
    };

    const form = el("form.entry-card__naming", {
      onsubmit: (event) => { event.preventDefault(); commit(input.value); },
    }, [
      input,
      el("div.milestone__buttons", {}, [
        el("button.link", { type: "submit", text: "Save" }),
        el("button.link.link--mute", { type: "button", text: "Cancel", onclick: () => form.remove() }),
        entry.milestone
          ? el("button.link.link--mute.link--danger", { type: "button", text: "Remove", onclick: () => commit("") })
          : null,
      ]),
    ]);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); form.remove(); }
    });

    card.append(form);
    input.focus();
    input.select();
  }

  return card;
}

/** Text nodes only — a search term is never injected as markup. */
function snippet(content, query) {
  const window_ = query ? matchWindow(content, query) : null;
  if (!window_) return [excerpt(content, 220)];
  return [window_.before, el("mark", { text: window_.match }), window_.after];
}

function select({ label, value, options, onchange, ariaLabel }) {
  const node = el("select.select", {
    "aria-label": ariaLabel,
    dataset: { active: String(Boolean(value)) },
    onchange: (event) => onchange(event.target.value),
  }, [el("option", { value: "", text: label })]);

  for (const option of options) {
    node.append(el("option", { value: option.value, text: option.label }));
  }
  node.value = value;
  return node;
}

function noMatches(onClear) {
  return el("div.empty", {}, [
    el("h2.empty__title", { text: "Nothing matches." }),
    el("p.empty__line", { text: "Try a different word, or look at everything again." }),
    el("button.btn.btn--ghost", { type: "button", text: "Show all pages", onclick: onClear }),
  ]);
}

function emptyLibrary() {
  return el("div.wrap", {}, [
    el("div.empty", {}, [
      el("h1.empty__title", { text: "Your pages will live here." }),
      el("p.empty__line", { text: "“Start with one thought.”" }),
      el("button.btn", {
        type: "button",
        text: "Write your first entry",
        onclick: () => go("/write"),
      }),
    ]),
  ]);
}

export function resetFilters() {
  filters.query = "";
  filters.mood = "";
  filters.month = "";
  filters.date = "";
  visibleMonth = todayKey().slice(0, 7);
}
