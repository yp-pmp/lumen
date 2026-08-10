/* A photograph, shown the way one gets tucked into a notebook.

   The polaroid is presentation only — a mount, a deep lower margin and a
   slight tilt, all in CSS. The stored picture stays the picture you took, so
   the look can change later, or come off entirely, without touching a pixel
   of what you kept. */

import { el } from "../utils/dom.js";
import { urlFor } from "../media.js";
import { plainDate } from "../utils/date.js";

/**
 * @param {string} id             image id
 * @param {object} options
 * @param {string} [options.takenOn]   day key, used for the description
 * @param {() => void} [options.onRemove]  shows a quiet remove control
 * @param {number} [options.index]     alternates the tilt
 */
export function polaroid(id, { takenOn = null, onRemove = null, index = 0 } = {}) {
  const image = el("img.polaroid__image", {
    alt: takenOn ? `Photograph kept with the page from ${plainDate(takenOn)}` : "Photograph kept with this page",
    loading: "lazy",
    decoding: "async",
  });

  const frame = el("figure.polaroid", { dataset: { tilt: String(index % 2) } }, [image]);

  urlFor(id).then((url) => {
    if (url) image.src = url;
    else frame.append(el("figcaption.polaroid__missing", { text: "This photograph isn't on this device." }));
  }).catch(() => {
    frame.append(el("figcaption.polaroid__missing", { text: "This photograph couldn't be opened." }));
  });

  if (onRemove) {
    frame.append(
      el("button.polaroid__remove", {
        type: "button",
        "aria-label": "Remove this photograph",
        title: "Remove",
        onclick: onRemove,
      }, ["×"])
    );
  }

  return frame;
}

export function polaroidRow(ids, options = {}) {
  const row = el("div.polaroids");
  ids.forEach((id, index) => row.append(polaroid(id, { ...options, index })));
  return row;
}
