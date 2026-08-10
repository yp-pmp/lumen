/* The writing surface.
   No toolbar. Autosave. The page persists itself the moment there is
   something worth keeping, and quietly discards itself if there isn't. */

import { el, icon, debounce, announce } from "../utils/dom.js";
import { go, back } from "../router.js";
import * as store from "../store.js";
import { promptFor, anotherPrompt } from "../prompts.js";
import { longDate, todayKey } from "../utils/date.js";
import { countWords } from "../utils/text.js";
import * as media from "../media.js";
import { polaroid } from "../components/polaroid.js";

const CLOSING_LINES = ["That's enough for today.", "Your thoughts are here.", "This is kept."];

export function render({ params }) {
  const existing = params.id ? store.getEntry(params.id) : null;
  if (params.id && !existing) return missing();

  const isNew = !existing;
  const seedPrompt = isNew ? promptFor(todayKey()) : null;

  let entry = existing
    ? { ...existing }
    : store.createEntry({
        date: todayKey(),
        prompt: seedPrompt.text,
        promptCategory: seedPrompt.category,
      });

  let persisted = Boolean(existing);
  let currentPrompt = entry.prompt
    ? { text: entry.prompt, category: entry.promptCategory }
    : null;

  /* --- nodes ------------------------------------------------------------ */

  const status = el("p.editor__status", { text: existing ? "Saved" : "" , dataset: { state: "idle" } });

  const area = el("textarea.editor__area", {
    "aria-label": "Your page",
    placeholder: "Begin anywhere…",
    spellcheck: "true",
    autocapitalize: "sentences",
    value: entry.content,
    rows: 1,
  });

  const promptBlock = el("div.prompt");
  const closing = el("p.closing", { hidden: true });
  const moodBlock = el("div.mood");
  const photoBlock = el("div.photos");

  const root = el("form.editor", {
    onsubmit: (event) => event.preventDefault(),
  }, [
    el("div.editor__bar", {}, [
      el("div.editor__bar-inner", {}, [
        el("button.editor__back", {
          type: "button",
          "aria-label": "Close this page",
          onclick: () => leave(),
        }, [icon("back"), el("span", { text: "Close" })]),
        status,
      ]),
    ]),
    el("header.editor__head", {}, [
      el("p.editor__date", { text: longDate(entry.date) }),
      promptBlock,
    ]),
    el("div.editor__body", {}, [area]),
    el("footer.editor__foot", {}, [closing, photoBlock, moodBlock]),
  ]);

  if (entry.content.trim()) root.classList.add("has-content");

  /* --- prompt ----------------------------------------------------------- */

  function drawPrompt() {
    promptBlock.replaceChildren();
    if (!currentPrompt) {
      promptBlock.append(
        el("div.prompt__meta", {}, [
          el("button.link.link--mute", {
            type: "button",
            text: "Give me a prompt",
            onclick: () => {
              currentPrompt = anotherPrompt(null);
              applyPrompt();
            },
          }),
        ])
      );
      return;
    }

    promptBlock.append(
      el("p.prompt__text", { text: currentPrompt.text }),
      el("div.prompt__meta", {}, [
        el("span.prompt__category", { text: currentPrompt.category }),
        el("button.link.link--mute", {
          type: "button",
          text: "Another prompt",
          onclick: () => {
            currentPrompt = anotherPrompt(currentPrompt);
            applyPrompt();
          },
        }),
        el("button.link.link--mute", {
          type: "button",
          text: "Write freely",
          onclick: () => {
            currentPrompt = null;
            applyPrompt();
          },
        }),
      ])
    );
  }

  function applyPrompt() {
    entry.prompt = currentPrompt?.text || null;
    entry.promptCategory = currentPrompt?.category || null;
    drawPrompt();
    if (persisted) save();
    area.focus();
  }

  /* --- mood ------------------------------------------------------------- */

  function drawMood() {
    // A blank page shouldn't ask how you feel. The question arrives with
    // the first words, and stays once an entry already carries a mood.
    if (!entry.content.trim() && !entry.mood && !entry.images?.length) {
      moodBlock.replaceChildren();
      return;
    }

    const options = el("div.mood__options", { role: "group", "aria-label": "How the day felt" });
    const moods = store.moodList();

    moods.forEach((mood, index) => {
      options.append(
        el("button.mood__option", {
          type: "button",
          text: mood,
          "aria-pressed": entry.mood === mood ? "true" : "false",
          onclick: () => {
            entry.mood = entry.mood === mood ? null : mood;
            drawMood();
            save();
            announce(entry.mood ? `Mood set to ${entry.mood}` : "Mood cleared");
          },
        })
      );
      if (index < moods.length - 1) options.append(el("span.mood__sep", { text: "·", "aria-hidden": "true" }));
    });

    moodBlock.replaceChildren(
      el("p.mood__label", { id: "mood-label", text: "If you'd like — how did it feel?" }),
      options
    );
  }


  /* --- photographs ------------------------------------------------------ */

  function drawPhotos() {
    if (!media.isSupported()) {
      photoBlock.replaceChildren();
      return;
    }

    const error = el("p.photos__error", { role: "status", "aria-live": "polite", hidden: true });

    const picker = el("input", {
      type: "file",
      accept: "image/*",
      multiple: true,
      hidden: true,
      onchange: async (event) => {
        const files = [...(event.target.files || [])];
        event.target.value = "";
        if (!files.length) return;

        error.hidden = true;
        for (const file of files) {
          try {
            const record = await media.addImage(file);
            entry.images = [...(entry.images || []), record.id];
            save();
            drawPhotos();
            drawMood();
          } catch (problem) {
            error.hidden = false;
            error.textContent = problem.message || "That image couldn't be added.";
          }
        }
      },
    });

    const row = el("div.polaroids");
    for (const [index, id] of (entry.images || []).entries()) {
      row.append(
        polaroid(id, {
          takenOn: entry.date,
          index,
          onRemove: async () => {
            entry.images = entry.images.filter((other) => other !== id);
            save();
            await media.deleteImages([id]);
            drawPhotos();
          },
        })
      );
    }

    photoBlock.replaceChildren(
      entry.images?.length ? row : null,
      el("button.link.link--mute", {
        type: "button",
        text: entry.images?.length ? "Add another photograph" : "Add a photograph",
        onclick: () => picker.click(),
      }),
      picker,
      error
    );
  }

  /* --- autosave --------------------------------------------------------- */

  function worthKeeping() {
    return Boolean(entry.content.trim()) || Boolean(entry.mood) || (entry.images?.length > 0);
  }

  function save() {
    if (!worthKeeping()) return;
    const saved = store.saveEntry(entry);
    entry = { ...entry, ...saved };
    persisted = true;
    status.dataset.state = "idle";
    status.textContent = "Saved just now";
    announce("Saved");
  }

  const saveSoon = debounce(() => save(), 700);

  const settleSoon = debounce(() => {
    if (!entry.content.trim()) return;
    if (closing.hidden) {
      closing.textContent = CLOSING_LINES[entry.id.length % CLOSING_LINES.length];
      closing.hidden = false;
    }
    if (status.textContent === "Saved just now") status.textContent = "Saved";
  }, 6000);

  function grow() {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }

  area.addEventListener("input", () => {
    const hadContent = Boolean(entry.content.trim());
    entry.content = area.value;
    entry.wordCount = countWords(entry.content);
    const hasContent = Boolean(entry.content.trim());
    if (hasContent !== hadContent) drawMood();
    root.classList.toggle("has-content", hasContent);
    root.classList.add("is-immersed");
    grow();

    if (worthKeeping()) {
      status.dataset.state = "saving";
      status.textContent = "Saving…";
      saveSoon();
    }
    if (!closing.hidden) closing.hidden = true;
    settleSoon();
  });

  area.addEventListener("blur", () => {
    saveSoon.flush();
    root.classList.remove("is-immersed");
  });

  area.addEventListener("keydown", (event) => {
    // Escape steps out of the page without losing a word.
    if (event.key === "Escape") {
      event.preventDefault();
      leave();
    }
  });

  function leave() {
    saveSoon.flush();
    settleSoon.cancel();
    if (worthKeeping()) {
      save();
      go(`/entry/${entry.id}`, { replace: true });
    } else {
      back("/");
    }
  }

  root.addEventListener("lumen:teardown", () => {
    saveSoon.flush();
    settleSoon.cancel();
    window.removeEventListener("beforeunload", onUnload);
  });

  function onUnload() {
    saveSoon.flush();
  }
  window.addEventListener("beforeunload", onUnload);

  drawPrompt();
  drawMood();
  drawPhotos();

  // Focus the writing area the moment the page opens.
  requestAnimationFrame(() => {
    grow();
    area.focus({ preventScroll: true });
    const end = area.value.length;
    area.setSelectionRange(end, end);
  });

  return root;
}

function missing() {
  return el("div.wrap", {}, [
    el("div.empty", {}, [
      el("h1.empty__title", { text: "That page isn't here." }),
      el("p.empty__line", { text: "It may have been deleted." }),
      el("button.btn.btn--ghost", { type: "button", text: "Back to today", onclick: () => go("/") }),
    ]),
  ]);
}
