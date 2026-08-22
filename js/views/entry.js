/* Reading a single page back. */

import { el, icon, announce, replace } from "../utils/dom.js";
import { go, back } from "../router.js";
import * as store from "../store.js";
import { longDate, timeOfDay, relativeTime } from "../utils/date.js";
import { readingTime } from "../utils/text.js";
import { deleteImages } from "../media.js";
import { polaroidRow } from "../components/polaroid.js";

export function render({ params }) {
  const entry = store.getEntry(params.id);
  if (!entry) return missing();

  const actions = el("div.page__actions");
  const milestoneSlot = el("div.milestone-slot");

  const view = el("article.wrap.page", {}, [
    el("button.editor__back", {
      type: "button",
      onclick: () => back("/journal"),
    }, [icon("back"), el("span", { text: "Back" })]),

    el("header.page__head", {}, [
      el("h1.page__date", { text: longDate(entry.date, { withYear: true }) }),
      metaLine(entry),
      milestoneSlot,
    ]),

    entry.prompt ? el("p.page__prompt", { text: entry.prompt }) : null,
    entry.content ? el("div.page__content", { text: entry.content }) : null,
    entry.images?.length ? polaroidRow(entry.images, { takenOn: entry.date }) : null,
    actions,
  ]);

  drawActions();
  drawMilestone();

  /* --- marking a moment --------------------------------------------------
     Offered here rather than in the editor: you rarely know at the time that
     a day mattered, and the writing surface stays clear of one more control. */

  function drawMilestone() {
    if (!entry.milestone) {
      replace(milestoneSlot);
      return;
    }
    replace(milestoneSlot,
      el("p.milestone", {}, [
        el("span.milestone__mark", { text: "Milestone", "aria-hidden": "true" }),
        el("span.milestone__label", { text: entry.milestone }),
      ])
    );
  }

  function editMilestone() {
    const input = el("input.milestone__input", {
      type: "text",
      value: entry.milestone || "",
      maxlength: String(store.milestoneLimit()),
      placeholder: "In a few words — what happened?",
      "aria-label": "What made this day a milestone?",
    });

    const commit = (value) => {
      entry.milestone = value.trim() || null;
      const saved = store.saveEntry(entry);
      Object.assign(entry, saved);
      drawMilestone();
      drawActions();
      announce(entry.milestone ? "Marked as a milestone" : "Milestone removed");
    };

    const form = el("form.milestone__form", {
      onsubmit: (event) => {
        event.preventDefault();
        commit(input.value);
      },
    }, [
      input,
      el("div.milestone__buttons", {}, [
        el("button.link", { type: "submit", text: "Save" }),
        el("button.link.link--mute", { type: "button", text: "Cancel", onclick: () => drawActions() }),
        entry.milestone
          ? el("button.link.link--mute.link--danger", {
              type: "button",
              text: "Remove",
              onclick: () => commit(""),
            })
          : null,
      ]),
    ]);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        drawActions();
      }
    });

    replace(actions, form);
    input.focus();
    input.select();
  }

  function drawActions() {
    replace(actions,
      el("button.link", {
        type: "button",
        text: "Edit this page",
        onclick: () => go(`/write/${entry.id}`),
      }),
      el("button.link.link--mute", {
        type: "button",
        text: entry.milestone ? "Change the milestone" : "Mark as a milestone",
        onclick: () => editMilestone(),
      }),
      el("button.link.link--mute.link--danger", {
        type: "button",
        text: "Delete",
        onclick: () => drawConfirm(),
      })
    );
  }

  function drawConfirm() {
    const confirm = el("div.confirm", { role: "group", "aria-label": "Confirm deletion" }, [
      el("span", { text: "Delete this page? It can't be undone." }),
      el("button.link.link--danger", {
        type: "button",
        text: "Delete",
        onclick: () => {
          const photographs = entry.images || [];
          store.deleteEntry(entry.id);
          // The page is gone; its pictures shouldn't linger in storage.
          deleteImages(photographs).catch(() => {});
          announce("Page deleted");
          go("/journal", { replace: true });
        },
      }),
      el("button.link.link--mute", { type: "button", text: "Keep it", onclick: () => drawActions() }),
    ]);
    replace(actions, confirm);
    confirm.querySelector("button").focus();
  }

  return view;
}

function metaLine(entry) {
  const parts = [timeOfDay(entry.createdAt)];
  if (entry.mood) parts.push(entry.mood);
  const reading = readingTime(entry.wordCount);
  if (reading) parts.push(reading);

  // Autosave touches updatedAt constantly while you write. Only call it an
  // edit if you came back to the page well after finishing it.
  const gap = new Date(entry.updatedAt) - new Date(entry.createdAt);
  if (gap > 30 * 60 * 1000) parts.push(`edited ${relativeTime(entry.updatedAt)}`);

  const meta = el("div.page__meta");
  parts.forEach((part, index) => {
    if (index) meta.append(el("span", { text: "·", "aria-hidden": "true" }));
    meta.append(el("span", { text: part }));
  });
  return meta;
}

function missing() {
  return el("div.wrap", {}, [
    el("div.empty", {}, [
      el("h1.empty__title", { text: "That page isn't here." }),
      el("p.empty__line", { text: "It may have been deleted." }),
      el("button.btn.btn--ghost", { type: "button", text: "Back to the journal", onclick: () => go("/journal") }),
    ]),
  ]);
}
