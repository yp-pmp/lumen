/* The writing surface.
   No toolbar. Autosave. The page persists itself the moment there is
   something worth keeping, and quietly discards itself if there isn't. */

import { el, icon, debounce, announce, replace } from "../utils/dom.js";
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
  const milestoneBlock = el("div.editor__milestone");

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
    el("footer.editor__foot", {}, [closing, photoBlock, moodBlock, milestoneBlock]),
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

    replace(moodBlock,
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
            drawMilestone();
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

    replace(photoBlock,
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

  /* --- marking the day ---------------------------------------------------
     Offered here as well as on the finished page, because some days announce
     themselves while you are still writing about them. Like mood, it waits
     for the first words rather than greeting a blank page. */

  function drawMilestone() {
    if (!entry.content.trim() && !entry.mood && !entry.images?.length && !entry.milestone) {
      replace(milestoneBlock);
      return;
    }

    if (!entry.milestone) {
      replace(milestoneBlock,
        el("button.link.link--mute", {
          type: "button",
          text: "Mark this page as a milestone",
          onclick: () => editMilestone(),
        })
      );
      return;
    }

    replace(milestoneBlock,
      el("p.milestone", {}, [
        el("span.milestone__mark", { text: "Milestone", "aria-hidden": "true" }),
        el("span.milestone__label", { text: entry.milestone }),
      ]),
      el("button.link.link--mute", {
        type: "button",
        text: "Change the milestone",
        onclick: () => editMilestone(),
      })
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
      save();
      drawMilestone();
      announce(entry.milestone ? "Marked as a milestone" : "Milestone removed");
    };

    const form = el("form.milestone__form", {
      onsubmit: (event) => { event.preventDefault(); commit(input.value); },
    }, [
      input,
      el("div.milestone__buttons", {}, [
        el("button.link", { type: "submit", text: "Save" }),
        el("button.link.link--mute", { type: "button", text: "Cancel", onclick: () => drawMilestone() }),
        entry.milestone
          ? el("button.link.link--mute.link--danger", { type: "button", text: "Remove", onclick: () => commit("") })
          : null,
      ]),
    ]);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); drawMilestone(); }
    });

    replace(milestoneBlock, form);
    input.focus();
    input.select();
  }

  /* --- autosave --------------------------------------------------------- */

  function worthKeeping() {
    return Boolean(entry.content.trim()) || Boolean(entry.mood)
      || (entry.images?.length > 0) || Boolean(entry.milestone);
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

  /**
   * Keep the writing area as tall as its text.
   *
   * The obvious implementation — set the height to "auto", then to
   * scrollHeight — collapses the textarea for one layout pass. On a long page
   * that shrinks the document from thousands of pixels to a few hundred, the
   * browser clamps the scroll position to fit, and the page leaps away from
   * the caret on every keystroke.
   *
   * So: only measure from scratch when the text may have got *shorter*, which
   * is the only time the height needs to come down. Typing forwards never
   * collapses anything. Either way the scroll position is put back if the
   * layout moved it.
   */
  let measuredLength = area.value.length;

  function grow({ remeasure = false } = {}) {
    const scroller = document.scrollingElement || document.documentElement;
    const top = scroller.scrollTop;
    const shrank = area.value.length < measuredLength;
    measuredLength = area.value.length;

    if (shrank || remeasure) area.style.height = "auto";
    if (area.scrollHeight !== area.clientHeight) {
      area.style.height = `${area.scrollHeight}px`;
    }

    if (scroller.scrollTop !== top) scroller.scrollTop = top;
  }

  area.addEventListener("input", () => {
    const hadContent = Boolean(entry.content.trim());
    entry.content = area.value;
    entry.wordCount = countWords(entry.content);
    const hasContent = Boolean(entry.content.trim());
    if (hasContent !== hadContent) { drawMood(); drawMilestone(); }
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

  document.documentElement.classList.add("is-writing");

  root.addEventListener("lumen:teardown", () => {
    document.documentElement.classList.remove("is-writing");
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
  drawMilestone();

  // Focus the writing area the moment the page opens.
  requestAnimationFrame(() => {
    grow({ remeasure: true });
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
