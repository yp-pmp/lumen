/* Tiny DOM helpers. No framework, no build step. */

/**
 * el("div.wrap", { onclick }, [children])
 * Tag may carry classes: "button.link.link--mute"
 */
export function el(spec, props = {}, children = []) {
  const [tag, ...classes] = String(spec).split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") {
      node.className = node.className ? `${node.className} ${value}` : value;
    } else if (key === "text") {
      node.textContent = value;
    } else if (key === "html") {
      node.innerHTML = value;
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== "list" && typeof value !== "object") {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : value);
    }
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Swap a node's contents. Use this rather than replaceChildren(): the native
 * method stringifies a null child into the literal text "null", which is how
 * you end up with the word printed on the page.
 */
export function replace(parent, ...children) {
  clear(parent);
  return append(parent, children);
}

/** Inline icons, drawn thin to match the type. */
const PATHS = {
  back: '<path d="M11 3.5 5.5 9l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  search:
    '<circle cx="7.6" cy="7.6" r="5.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11.4 11.4 15 15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  chevronLeft:
    '<path d="M10.5 4 6 9l4.5 5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronRight:
    '<path d="M7.5 4 12 9l-4.5 5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  settings:
    '<circle cx="9" cy="9" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="9" r="1.9" fill="currentColor"/>',
  // Echoes the dot on the Milestones timeline: an open ring until it is marked.
  milestone:
    '<circle cx="9" cy="9" r="5.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  milestoneOn:
    '<circle cx="9" cy="9" r="5.4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="2.5" fill="currentColor"/>',
};

export function icon(name, label) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("focusable", "false");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  svg.innerHTML = PATHS[name] || "";
  return svg;
}

/** Debounce that also exposes flush(), so we never lose the last keystroke. */
export function debounce(fn, wait) {
  let timer = null;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const args2 = lastArgs;
      lastArgs = null;
      fn(...args2);
    }, wait);
  };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      const args = lastArgs;
      lastArgs = null;
      if (args) fn(...args);
    }
  };
  wrapped.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return wrapped;
}

export function announce(message) {
  const node = document.getElementById("announcer");
  if (node) node.textContent = message;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
