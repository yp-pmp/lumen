/* A month, drawn as quietly as possible. ○ no page · ● a page */

import { el, icon } from "../utils/dom.js";
import { monthGrid, shiftMonth, monthTitle, todayKey, plainDate } from "../utils/date.js";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * @param {object} options
 * @param {string} options.month        YYYY-MM
 * @param {Map<string, number>} options.counts  day key → number of pages
 * @param {(ym: string) => void} options.onMonth
 * @param {(dayKey: string) => void} options.onDay
 * @param {string} [options.selected]
 * @param {string} [options.earliest]   YYYY-MM, limits backward paging
 */
export function calendar({ month, counts, onMonth, onDay, selected = "", earliest = null }) {
  const { year, month: monthNumber, offset, total } = monthGrid(month);
  const today = todayKey();
  const nowMonth = today.slice(0, 7);

  const grid = el("div.calendar__grid", { role: "grid", "aria-label": `Pages in ${monthTitle(month)}` });

  for (const letter of DOW) {
    grid.append(el("div.calendar__dow", { text: letter, "aria-hidden": "true" }));
  }
  for (let i = 0; i < offset; i += 1) {
    grid.append(el("div.calendar__day", { dataset: { empty: "true" }, "aria-hidden": "true" }));
  }

  for (let day = 1; day <= total; day += 1) {
    const key = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = counts.get(key) || 0;
    const dataset = {
      has: String(count > 0),
      today: String(key === today),
      multi: String(count > 1),
      selected: String(key === selected),
    };

    // Only days that hold something are announced or focusable. Thirty empty
    // cells read as noise to a screen reader and give a keyboard nothing to do.
    grid.append(
      count > 0
        ? el("button.calendar__day", {
            type: "button",
            dataset,
            "aria-label": `${plainDate(key)} — ${count} ${count === 1 ? "page" : "pages"}`,
            onclick: () => onDay(key),
          }, [el("span.calendar__dot", { "aria-hidden": "true" })])
        : el("span.calendar__day", { dataset, "aria-hidden": "true" }, [el("span.calendar__dot")])
    );
  }

  const canGoBack = !earliest || month > earliest;
  const canGoForward = month < nowMonth;

  return el("section.calendar", {}, [
    el("div.calendar__head", {}, [
      el("h3.calendar__month", { text: monthTitle(month) }),
      el("div.calendar__nav", {}, [
        el("button.calendar__arrow", {
          type: "button",
          "aria-label": "Previous month",
          disabled: !canGoBack,
          onclick: () => onMonth(shiftMonth(month, -1)),
        }, [icon("chevronLeft")]),
        el("button.calendar__arrow", {
          type: "button",
          "aria-label": "Next month",
          disabled: !canGoForward,
          onclick: () => onMonth(shiftMonth(month, 1)),
        }, [icon("chevronRight")]),
      ]),
    ]),
    grid,
  ]);
}
