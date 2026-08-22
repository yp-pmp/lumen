/* Reflections — looking backward, without a scoreboard. */

import { el, debounce } from "../utils/dom.js";
import { go } from "../router.js";
import * as store from "../store.js";
import { monthTitle, monthKey, todayKey, plainDate } from "../utils/date.js";
import { excerpt, findThemes } from "../utils/text.js";

export function render() {
  const entries = store.allEntries().filter(store.hasSubstance);
  const thisMonth = monthKey(todayKey());
  const monthEntries = entries.filter((entry) => monthKey(entry.date) === thisMonth);
  const months = store.monthsWithEntries();

  if (entries.length < 2) return sparse(entries.length);

  const view = el("div.wrap", {}, [
    el("h1.sr-only", { text: "Reflections" }),
    el("p.eyebrow", { text: "This month" }),
    el("h2.title", { text: monthTitle(thisMonth), style: { marginTop: "0.5rem" } }),
  ]);

  if (!monthEntries.length) {
    view.append(
      el("p.lead.italic", {
        text: "Nothing written this month yet. The months below are still here.",
        style: { marginTop: "1.5rem" },
      })
    );
  } else {
    view.append(el("div", { style: { marginTop: "2rem" } }, [statList(monthEntries)]));
  }

  const marked = milestoneTimeline();
  if (marked) view.append(marked);

  if (months.length) {
    view.append(
      el("section.section", {}, [
        el("h2.section__label", { text: "Every month" }),
        monthList(months),
      ])
    );
  }

  return view;
}

/**
 * The moments you marked, earliest first, so a life reads forwards.
 * No counts, no progress, nothing to complete — just what happened, and when.
 */
function milestoneTimeline() {
  const marked = store.milestones();
  if (!marked.length) return null;

  const section = el("section.section", {}, [
    el("h2.section__label", { text: "Milestones" }),
  ]);

  const list = el("ol.timeline-marks");
  let lastYear = null;

  for (const entry of marked) {
    const year = entry.date.slice(0, 4);
    if (year !== lastYear) {
      lastYear = year;
      list.append(el("li.timeline-marks__year", { text: year, "aria-hidden": "true" }));
    }

    list.append(
      el("li.timeline-marks__item", {}, [
        el("button.timeline-marks__button", {
          type: "button",
          "aria-label": `${entry.milestone} — ${plainDate(entry.date)}. Open the page.`,
          onclick: () => go(`/entry/${entry.id}`),
        }, [
          el("span.timeline-marks__dot", { "aria-hidden": "true" }),
          el("span.timeline-marks__label", { text: entry.milestone }),
          el("span.timeline-marks__date", { text: plainDate(entry.date) }),
        ]),
      ])
    );
  }

  section.append(list);
  return section;
}

/* --- this month ----------------------------------------------------------- */

function statList(entries) {
  const days = new Set(entries.map((entry) => entry.date));
  const longest = entries.reduce((best, entry) => (entry.wordCount > (best?.wordCount || 0) ? entry : best), null);

  const rows = [
    ["Entries", `${entries.length}`],
    ["Days written", `${days.size}`],
  ];

  const mood = mostCommon(entries.map((entry) => entry.mood).filter(Boolean));
  if (mood) rows.push(["Most common mood", mood]);

  const category = mostCommon(entries.map((entry) => entry.promptCategory).filter(Boolean));
  if (category) rows.push(["Most used prompt", category]);

  const list = el("div.stat-list");
  for (const [label, value] of rows) {
    list.append(
      el("div.stat-row", {}, [
        el("span.stat-row__label", { text: label }),
        el("span.stat-row__value", { text: value }),
      ])
    );
  }

  if (longest && longest.wordCount > 0) {
    list.append(
      el("div.stat-row", {}, [
        el("span.stat-row__label", { text: "Longest page" }),
        el("span.stat-row__value", {}, [
          el("button.link", {
            type: "button",
            text: `${plainDate(longest.date)} — ${longest.wordCount} words`,
            onclick: () => go(`/entry/${longest.id}`),
          }),
        ]),
      ])
    );
  }

  return list;
}

function monthList(months) {
  const list = el("div.month-list");
  for (const { ym, count } of months) {
    list.append(
      el("button.month-row", {
        type: "button",
        onclick: () => go(`/reflections/${ym}`),
      }, [
        el("span.month-row__name", { text: monthTitle(ym) }),
        el("span.month-row__count", { text: `${count} ${count === 1 ? "page" : "pages"}` }),
      ])
    );
  }
  return list;
}

/* --- a single month ------------------------------------------------------- */

export function renderMonth({ params }) {
  const ym = params.ym;
  const entries = store.entriesInMonth(ym).filter(store.hasSubstance);

  if (!entries.length) {
    return el("div.wrap", {}, [
      backLink(),
      el("div.empty", {}, [
        el("h1.empty__title", { text: monthTitle(ym) }),
        el("p.empty__line", { text: "No pages from this month." }),
      ]),
    ]);
  }

  const days = new Set(entries.map((entry) => entry.date));
  const view = el("div.wrap", {}, [
    backLink(),
    el("h1.display", { text: monthTitle(ym), style: { marginTop: "1.5rem" } }),
    el("p.lead", {
      text: `You wrote ${entries.length} ${entries.length === 1 ? "time" : "times"} this month, across ${days.size} ${days.size === 1 ? "day" : "days"}.`,
      style: { marginTop: "1.25rem" },
    }),
  ]);

  const themeSection = themes(entries);
  if (themeSection) view.append(themeSection);

  view.append(pages(ym, entries));
  view.append(carry(ym));

  return view;
}

function themes(entries) {
  // Fewer than three surviving words means there is no pattern worth naming.
  const words = findThemes(entries.map((entry) => entry.content), { limit: 7 });
  const recurring = words.length >= 3 ? words : [];

  const moods = entries.map((entry) => entry.mood).filter(Boolean);
  const categories = entries.map((entry) => entry.promptCategory).filter(Boolean);
  const mood = mostCommon(moods);
  const category = mostCommon(categories);

  if (!recurring.length && !mood && !category) return null;

  const section = el("section.section", {}, [
    el("h2.section__label", { text: "What you wrote about" }),
  ]);

  if (recurring.length) {
    const line = el("p.themes");
    for (const theme of recurring) {
      line.append(
        el("span.theme", {
          text: theme.word,
          title: `In ${theme.entries} ${theme.entries === 1 ? "page" : "pages"}`,
        })
      );
    }
    section.append(
      line,
      el("p.quiet.faint", {
        text: "Words that kept returning, counted here on your device.",
        style: { marginTop: "0.75rem" },
      })
    );
  }

  const lines = [];
  if (mood) lines.push(`Most often, the days felt ${mood.toLowerCase()}.`);
  // Kept as a proper noun: "a prompt from Today" reads; "today prompts" doesn't.
  if (category) lines.push(`Most often you chose a prompt from ${category}.`);
  if (lines.length) {
    section.append(
      el("p.lead", { text: lines.join(" "), style: { marginTop: recurring.length ? "2rem" : "0.5rem" } })
    );
  }

  return section;
}

function pages(ym, entries) {
  const name = monthTitle(ym).split(",")[0];

  // Longest, shortest and one from the middle — a fair sample of the month.
  const byLength = entries.filter((entry) => entry.content.trim()).sort((a, b) => b.wordCount - a.wordCount);
  if (!byLength.length) return el("div");
  const picks = [];
  const seen = new Set();
  for (const candidate of [byLength[0], byLength[Math.floor(byLength.length / 2)], byLength[byLength.length - 1]]) {
    if (candidate && !seen.has(candidate.id)) {
      seen.add(candidate.id);
      picks.push(candidate);
    }
  }
  picks.sort((a, b) => (a.date < b.date ? -1 : 1));

  const section = el("section.section", {}, [
    el("h2.section__label", { text: `A few pages from ${name}` }),
  ]);

  for (const entry of picks) {
    section.append(
      el("figure.excerpt", {}, [
        el("figcaption.excerpt__date", { text: plainDate(entry.date) }),
        el("blockquote.excerpt__text", { text: `“${excerpt(entry.content, 260)}”` }),
        el("button.link", {
          type: "button",
          text: "Read the page",
          onclick: () => go(`/entry/${entry.id}`),
          style: { marginTop: "0.75rem" },
        }),
      ])
    );
  }

  return section;
}

function carry(ym) {
  const next = nextMonthLabel(ym);
  const area = el("textarea.carry__area", {
    "aria-label": `What do you want to carry into ${next}?`,
    placeholder: "Anything at all…",
    value: store.getReflection(ym),
  });

  const status = el("p.carry__status", { role: "status", "aria-live": "polite" });

  const save = debounce(() => {
    store.saveReflection(ym, area.value);
    status.textContent = "Saved";
  }, 600);

  area.addEventListener("input", () => {
    status.textContent = "Saving…";
    save();
  });
  area.addEventListener("blur", () => save.flush());

  return el("section.carry", {}, [
    el("hr.rule"),
    el("h2.carry__question", { text: `What do you want to carry into ${next}?` }),
    area,
    status,
  ]);
}

function nextMonthLabel(ym) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month, 1);
  return monthTitle(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`).split(",")[0];
}

function backLink() {
  return el("button.editor__back", {
    type: "button",
    onclick: () => go("/reflections"),
    text: "← Reflections",
  });
}

/* --- shared --------------------------------------------------------------- */

function mostCommon(values) {
  if (!values.length) return null;
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function sparse(count) {
  return el("div.wrap", {}, [
    el("div.empty", {}, [
      el("h1.empty__title", { text: "Not much to look back on yet." }),
      el("p.empty__line", { text: "“This space will become more interesting as you write.”" }),
      el("button.btn", {
        type: "button",
        text: count ? "Write another page" : "Write your first entry",
        onclick: () => go("/write"),
      }),
    ]),
  ]);
}
