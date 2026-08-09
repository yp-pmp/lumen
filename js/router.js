/* Hash routing — works from a plain static host, or a file on disk. */

const routes = [
  { name: "today", pattern: /^\/?$/ },
  { name: "write", pattern: /^\/write$/ },
  { name: "write", pattern: /^\/write\/([^/]+)$/, params: ["id"] },
  { name: "entry", pattern: /^\/entry\/([^/]+)$/, params: ["id"] },
  { name: "journal", pattern: /^\/journal$/ },
  { name: "reflections", pattern: /^\/reflections$/ },
  { name: "month", pattern: /^\/reflections\/(\d{4}-\d{2})$/, params: ["ym"] },
];

let handler = () => {};

export function parse(hash = window.location.hash) {
  const path = hash.replace(/^#/, "") || "/";
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    const params = {};
    (route.params || []).forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return { name: route.name, params, path };
  }
  return { name: "today", params: {}, path: "/" };
}

export function start(onRoute) {
  handler = onRoute;
  window.addEventListener("hashchange", () => handler(parse()));
  handler(parse());
}

export function go(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) {
    handler(parse());
    return;
  }
  if (replace) {
    window.location.replace(`${window.location.pathname}${window.location.search}${target}`);
  } else {
    window.location.hash = target;
  }
}

export function href(path) {
  return `#${path}`;
}

export function back(fallback = "/") {
  if (window.history.length > 1) window.history.back();
  else go(fallback, { replace: true });
}
