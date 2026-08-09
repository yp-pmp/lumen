/* A small sheet, out of the way: appearance, demo pages, your data. */

import { el, announce } from "../utils/dom.js";
import * as store from "../store.js";
import { buildDemoEntries } from "../data/demo.js";

export function openSettings({ onChange }) {
  const existing = document.getElementById("lumen-settings");
  if (existing) existing.remove();

  const dialog = el("dialog.sheet", { id: "lumen-settings", "aria-label": "Settings" });

  function draw() {
    const settings = store.getSettings();

    const themeRow = el("div.segmented", { role: "group", "aria-label": "Appearance" });
    for (const [value, label] of [["light", "Light"], ["dark", "Dark"], ["auto", "System"]]) {
      themeRow.append(
        el("button", {
          type: "button",
          text: label,
          "aria-pressed": settings.theme === value ? "true" : "false",
          onclick: () => {
            store.updateSettings({ theme: value });
            onChange();
            draw();
          },
        })
      );
    }

    const demoRow = el("div.sheet__row");
    if (store.hasDemoEntries()) {
      demoRow.append(
        el("button.link.link--danger", {
          type: "button",
          text: "Remove demo pages",
          onclick: () => {
            store.removeDemoEntries();
            announce("Demo pages removed");
            onChange();
            draw();
          },
        })
      );
    } else {
      demoRow.append(
        el("button.link", {
          type: "button",
          text: "Add demo pages",
          onclick: () => {
            store.addEntries(buildDemoEntries());
            announce("Demo pages added");
            onChange();
            draw();
          },
        })
      );
    }

    const importNote = el("p.sheet__note", { role: "status", "aria-live": "polite", hidden: true });

    const dataRow = el("div.sheet__row", {}, [
      el("button.link", { type: "button", text: "Export everything", onclick: exportAll }),
      el("button.link", {
        type: "button",
        text: "Bring in a backup",
        onclick: () => importFile(importNote, onChange),
      }),
      el("button.link.link--mute.link--danger", {
        type: "button",
        text: "Delete everything",
        onclick: (event) => confirmWipe(event.currentTarget),
      }),
    ]);

    function confirmWipe(trigger) {
      const confirm = el("div.confirm", {}, [
        el("span", { text: "Delete every page? This cannot be undone." }),
        el("button.link.link--danger", {
          type: "button",
          text: "Delete",
          onclick: () => {
            store.clearEverything();
            announce("Everything deleted");
            onChange();
            dialog.close();
          },
        }),
        el("button.link.link--mute", { type: "button", text: "Cancel", onclick: () => draw() }),
      ]);
      trigger.parentElement.replaceChildren(confirm);
      confirm.querySelector("button").focus();
    }

    dialog.replaceChildren(
      el("h2.sheet__title", { text: "Settings" }),

      el("div.sheet__group", {}, [
        el("p.sheet__label", { text: "Appearance" }),
        themeRow,
      ]),

      el("div.sheet__group", {}, [
        el("p.sheet__label", { text: "Demo pages" }),
        demoRow,
        el("p.sheet__note", {
          text: "Fictional entries for trying things out. They are marked as demo data and can be removed without touching anything you've written.",
        }),
      ]),

      el("div.sheet__group", {}, [
        el("p.sheet__label", { text: "Your writing" }),
        dataRow,
        importNote,
        el("p.sheet__note", {
          text: "Everything you write is stored only in this browser, on this device — a phone keeps its own journal. Export here, then bring that file in on the other device to join them up.",
        }),
      ]),

      el("div.sheet__close", {}, [
        el("button.btn.btn--ghost", { type: "button", text: "Close", onclick: () => dialog.close() }),
      ])
    );
  }

  draw();
  dialog.addEventListener("close", () => dialog.remove());
  document.getElementById("overlay-root").append(dialog);
  dialog.showModal();
}

/**
 * Read an exported file from disk and merge it in. The file is parsed here,
 * in the browser — it is never uploaded anywhere.
 */
function importFile(note, onChange) {
  const picker = el("input", { type: "file", accept: "application/json,.json", hidden: true });

  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    picker.remove();
    if (!file) return;

    note.hidden = false;
    note.textContent = "Reading…";

    try {
      const result = store.importData(JSON.parse(await file.text()));
      const parts = [];
      if (result.added) parts.push(`${result.added} ${result.added === 1 ? "page" : "pages"} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.unchanged) parts.push(`${result.unchanged} already up to date`);
      if (result.notes) parts.push(`${result.notes} month ${result.notes === 1 ? "note" : "notes"}`);
      note.textContent = parts.length ? `${parts.join(", ")}.` : "Nothing in that file.";
      announce(note.textContent);
      onChange();
    } catch (error) {
      note.textContent = "That file doesn't look like a LUMEN export.";
      announce(note.textContent);
    }
  });

  document.body.append(picker);
  picker.click();
}

function exportAll() {
  const data = store.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: `lumen-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("Export downloaded");
}
