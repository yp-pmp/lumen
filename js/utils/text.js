/* Text measurement, excerpting, and a small local word-frequency pass.
   Everything here runs in the browser. Journal text is never sent anywhere
   and is never written to the console. */

const WORDS_PER_MINUTE = 220;

export function countWords(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function readingTime(words) {
  if (!words) return "";
  const minutes = words / WORDS_PER_MINUTE;
  if (minutes < 1) return "under a minute";
  const rounded = Math.round(minutes);
  return `${rounded} minute${rounded === 1 ? "" : "s"}`;
}

/** First sentence-ish slice, tidied for a timeline. */
export function excerpt(text, limit = 180) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit).trimEnd()}…`;
}

/**
 * A window of text around the first match, for search results.
 * Returns { before, match, after } so the caller can mark it up safely
 * with text nodes (no innerHTML, no injection surface).
 */
export function matchWindow(text, query, radius = 90) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return null;
  const index = source.toLowerCase().indexOf(needle);
  if (index === -1) return null;

  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + needle.length + radius);
  return {
    before: (start > 0 ? "…" : "") + source.slice(start, index),
    match: source.slice(index, index + needle.length),
    after: source.slice(index + needle.length, end) + (end < source.length ? "…" : ""),
  };
}

/* Common words carry no theme. The list is deliberately generous: a thin,
   honest handful of words is worth more than a cloud padded with "really". */
const STOPWORDS = new Set(`about above after again against almost alone along already also although always
among another anyone anything around because been before behind being below beside better between beyond
both bring brought came cannot come comes coming could course days doing done down during each either
else enough even evening ever every everyone everything except feel feels felt find finds first following
found four from front full gave getting give given goes going gone good great half hard have having hear
heard here hers herself himself hour hours house huge idea into itself just keep keeps kept kind knew know
known large last late later least leave left less like liked likes little long longer look looked looking
looks made make makes making many maybe mean means might mine minute minutes month months more morning most
mostly much must myself near need needed needs never next nice night nothing notice noticed once only other
others ought ourselves outside over own part particular people perhaps place point probably properly quite
rather real really reason right room said same saw says seem seemed seems seen sense several shall should
show showed side since small some someone something sometimes somewhere soon sort spent start started still
stop stopped such sure take taken takes talk talked tell telling than that their theirs them themselves then
there these they thing things think thinking third this those though thought three through time times today
together told took toward turn turned under until upon used uses using very want wanted wants watch watched
week weeks well went were what when where whether which while whole whom whose will with within without
words work worked would wrote year years yesterday your yours yourself
actually anyway completely decided entirely exactly honestly instead meant obviously ordinary
seriously suddenly treating usually wondered wondering`
  .split(/\s+/)
  .filter(Boolean));

/**
 * Recurring themes: words that came back across several entries, not just
 * many times in one. Runs entirely locally over the given texts.
 *
 * The thresholds are deliberately strict. A short, true list is the point;
 * a padded one would be a fabricated insight, which is worse than none.
 */
export function findThemes(texts, { limit = 8, minDocs = 2, minLength = 5, minTotal = 2 } = {}) {
  const total = new Map();
  const docs = new Map();

  for (const text of texts) {
    const seen = new Set();
    const words = String(text || "")
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9'\s-]/g, " ")
      .split(/\s+/);

    for (let word of words) {
      word = word.replace(/^['-]+|['-]+$/g, "");
      // Contractions ("i've", "didn't") are grammar, not subject matter.
      if (word.includes("'")) continue;
      if (word.length < minLength || STOPWORDS.has(word) || /\d/.test(word)) continue;
      total.set(word, (total.get(word) || 0) + 1);
      seen.add(word);
    }
    for (const word of seen) docs.set(word, (docs.get(word) || 0) + 1);
  }

  // Fold simple plurals into their singular when both are present.
  for (const word of [...total.keys()]) {
    if (!word.endsWith("s")) continue;
    const singular = word.slice(0, -1);
    if (total.has(singular)) {
      total.set(singular, total.get(singular) + total.get(word));
      docs.set(singular, Math.max(docs.get(singular) || 0, docs.get(word) || 0));
      total.delete(word);
      docs.delete(word);
    }
  }

  const requiredDocs = texts.length >= minDocs ? minDocs : 1;

  return [...total.entries()]
    .filter(([word, count]) => (docs.get(word) || 0) >= requiredDocs && count >= minTotal)
    .sort((a, b) => (docs.get(b[0]) - docs.get(a[0])) || (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, entries: docs.get(word) }));
}

/** Stable small hash — lets "occasional" features be steady within a day. */
export function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}
