/* Three quiet screens. Skippable at any moment. */

import { el, replace } from "../utils/dom.js";

const SLIDES = [
  { lines: ["A quiet place for your thoughts."] },
  {
    lines: [
      "You don't have to write every day.",
      "You don't have to write something profound.",
      "You only need somewhere to begin.",
    ],
  },
  { lines: ["Your first page is waiting."] },
];

export function onboarding({ onFinish }) {
  let index = 0;

  const slide = el("div.onboard__slide");
  const dots = el("div.onboard__dots", { "aria-hidden": "true" });
  const nextButton = el("button.btn", { type: "button", text: "Next", onclick: () => advance() });
  const skipButton = el("button.link.link--mute", {
    type: "button",
    text: "Skip introduction",
    onclick: () => finish("skip"),
  });

  const root = el("section.onboard", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Welcome to LUMEN",
  }, [
    el("div.onboard__inner", {}, [
      slide,
      el("div.onboard__foot", {}, [nextButton, skipButton, dots]),
    ]),
  ]);

  function draw() {
    replace(slide,
      ...SLIDES[index].lines.map((line) => el("p.onboard__text", { text: line }))
    );
    // Restart the entrance animation on each slide.
    slide.style.animation = "none";
    void slide.offsetWidth;
    slide.style.animation = "";

    nextButton.textContent = index === SLIDES.length - 1 ? "Begin" : "Next";
    skipButton.hidden = index === SLIDES.length - 1;

    replace(dots,
      ...SLIDES.map((_, i) => el("span.onboard__dot", { dataset: { on: String(i === index) } }))
    );
    nextButton.focus();
  }

  function advance() {
    if (index < SLIDES.length - 1) {
      index += 1;
      draw();
    } else {
      finish("begin");
    }
  }

  function finish(reason) {
    root.remove();
    document.removeEventListener("keydown", onKey);
    onFinish(reason);
  }

  function onKey(event) {
    if (event.key === "Escape") finish("skip");
    if (event.key === "ArrowRight") advance();
    if (event.key === "ArrowLeft" && index > 0) {
      index -= 1;
      draw();
    }
  }
  document.addEventListener("keydown", onKey);

  draw();
  return root;
}
