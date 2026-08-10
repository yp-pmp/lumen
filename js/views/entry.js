/* Reading a single page back. */

import { el, icon, announce } from "../utils/dom.js";
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

  const view = el("article.wrap.page", {}, [
    el("button.editor__back", {
      type: "button",
      onclick: () => back("/journal"),
    }, [icon("back"), el("span", { text: "Back" })]),

    el("header.page__head", {}, [
      el("h1.page__date", { text: longDate(entry.date, { withYear: true }) }),
      metaLine(entry),
    ]),

    entry.prompt ? el("p.page__prompt", { text: entry.prompt }) : null,
    entry.content ? el("div.page__content", { text: entry.content }) : null,
    entry.images?.length ? polaroidRow(entry.images, { takenOn: entry.date }) : null,
    actions,
  ]);

  drawActions();

  function drawActions() {
    actions.replaceChildren(
      el("button.link", {
        type: "button",
        text: "Edit this page",
        onclick: () => go(`/write/${entry.id}`),
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
    actions.replaceChildren(confirm);
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
