/* ==========================================================================
   store.js — local-first persistence
   Journal content lives in this browser's localStorage and goes nowhere else.
   No fetch, no analytics, no third parties. The shape below is deliberately
   sync-friendly (stable ids + updatedAt) so a future cloud layer could be
   added without reshaping the data.
   ========================================================================== */

import { dayKey, monthKey, todayKey, daysBetween } from "./utils/date.js";
import { countWords } from "./utils/text.js";
import * as media from "./media.js";

const KEYS = {
  entries: "lumen.v1.entries",
  settings: "lumen.v1.settings",
  reflections: "lumen.v1.reflections",
  deleted: "lumen.v1.deleted",
};

const DEFAULT_SETTINGS = {
  theme: "auto",   // auto | light | dark
  onboarded: false,
};

const MOODS = ["Peaceful", "Happy", "Reflective", "Energized", "Tired", "Anxious", "Sad", "Grateful"];

let entries = [];
let settings = { ...DEFAULT_SETTINGS };
let reflections = {};
/* Ids of pages that were deleted, and when — no content, just a record that
   the deletion happened, so it can travel to another device instead of the
   page reappearing on the next import. */
let deleted = {};
let storageAvailable = true;

/* --- plumbing ------------------------------------------------------------- */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    // Never log the payload itself — only that it could not be read.
    console.warn(`LUMEN: could not read "${key}" from local storage.`);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    storageAvailable = false;
    console.warn("LUMEN: local storage is unavailable — this session will not persist.");
    return false;
  }
}

function sortEntries() {
  // Newest first: by day, then by the moment it was started.
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
}

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* --- lifecycle ------------------------------------------------------------ */

export function load() {
  // Private windows and locked-down browsers hand back a storage object that
  // throws on write. Find out now, not after someone has written a page.
  try {
    const probe = "lumen.v1.probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch (error) {
    storageAvailable = false;
  }

  const stored = readJSON(KEYS.entries, []);
  entries = Array.isArray(stored) ? stored.filter(isEntryish).map(normalise) : [];
  settings = { ...DEFAULT_SETTINGS, ...readJSON(KEYS.settings, {}) };
  reflections = readJSON(KEYS.reflections, {}) || {};
  deleted = readJSON(KEYS.deleted, {}) || {};
  sortEntries();

  // Another tab wrote something — stay in step.
  window.addEventListener("storage", (event) => {
    if (!Object.values(KEYS).includes(event.key)) return;
    const fresh = readJSON(KEYS.entries, []);
    entries = Array.isArray(fresh) ? fresh.filter(isEntryish).map(normalise) : [];
    settings = { ...DEFAULT_SETTINGS, ...readJSON(KEYS.settings, {}) };
    reflections = readJSON(KEYS.reflections, {}) || {};
    deleted = readJSON(KEYS.deleted, {}) || {};
    sortEntries();
    for (const listener of externalListeners) listener();
  });
}

/* Changes that arrived from another tab, as opposed to this one's own saves.
   Only these should redraw a view out from under someone who is writing. */
const externalListeners = new Set();

export function subscribeExternal(listener) {
  externalListeners.add(listener);
  return () => externalListeners.delete(listener);
}

function isEntryish(value) {
  return value && typeof value === "object" && typeof value.id === "string";
}

function normalise(entry) {
  const createdAt = entry.createdAt || new Date().toISOString();
  const content = typeof entry.content === "string" ? entry.content : "";
  return {
    id: entry.id,
    createdAt,
    updatedAt: entry.updatedAt || createdAt,
    date: entry.date || dayKey(new Date(createdAt)),
    content,
    mood: MOODS.includes(entry.mood) ? entry.mood : null,
    prompt: typeof entry.prompt === "string" && entry.prompt ? entry.prompt : null,
    promptCategory: typeof entry.promptCategory === "string" ? entry.promptCategory : null,
    wordCount: typeof entry.wordCount === "number" ? entry.wordCount : countWords(content),
    images: Array.isArray(entry.images) ? entry.images.filter((id) => typeof id === "string") : [],
    isDemo: entry.isDemo === true || undefined,
  };
}

/** A page counts if it holds words or a photograph. */
export function hasSubstance(entry) {
  return Boolean(entry?.content?.trim()) || (entry?.images?.length > 0);
}

export function isPersistent() {
  return storageAvailable;
}

/* --- entries -------------------------------------------------------------- */

export function allEntries() {
  return entries;
}

export function getEntry(id) {
  return entries.find((entry) => entry.id === id) || null;
}

export function entriesOn(key) {
  return entries.filter((entry) => entry.date === key);
}

export function entriesInMonth(ym) {
  return entries.filter((entry) => monthKey(entry.date) === ym);
}

export function createEntry({ date = todayKey(), prompt = null, promptCategory = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    date,
    content: "",
    mood: null,
    prompt,
    promptCategory,
    wordCount: 0,
    images: [],
  };
}

/** Insert or update. Returns the stored entry. */
export function saveEntry(entry) {
  const record = normalise({
    ...entry,
    updatedAt: new Date().toISOString(),
    wordCount: countWords(entry.content),
  });
  const index = entries.findIndex((item) => item.id === record.id);
  if (index === -1) entries.push(record);
  else entries[index] = { ...entries[index], ...record };
  sortEntries();
  writeJSON(KEYS.entries, entries);

  // Writing to a page undoes any record of it having been deleted.
  if (deleted[record.id]) {
    delete deleted[record.id];
    writeJSON(KEYS.deleted, deleted);
  }
  return record;
}

export function deleteEntry(id) {
  const before = entries.length;
  entries = entries.filter((entry) => entry.id !== id);
  if (entries.length === before) return;

  deleted[id] = new Date().toISOString();
  writeJSON(KEYS.entries, entries);
  writeJSON(KEYS.deleted, deleted);
}

export function addEntries(list) {
  entries = entries.concat(list.map(normalise));
  sortEntries();
  writeJSON(KEYS.entries, entries);
}

/* --- demo data ------------------------------------------------------------ */

export function hasDemoEntries() {
  return entries.some((entry) => entry.isDemo);
}

export function removeDemoEntries() {
  // No deletion records here on purpose: demo pages are meant to be added and
  // removed freely, and tombstoning them would stop them coming back.
  entries = entries.filter((entry) => !entry.isDemo);
  writeJSON(KEYS.entries, entries);
}

/* --- settings ------------------------------------------------------------- */

export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  writeJSON(KEYS.settings, settings);
  return settings;
}

/* --- month reflections (the "carry into next month" note) ----------------- */

export function getReflection(ym) {
  return reflections[ym]?.note || "";
}

export function saveReflection(ym, note) {
  reflections[ym] = { note, updatedAt: new Date().toISOString() };
  writeJSON(KEYS.reflections, reflections);
}

/* --- derived ------------------------------------------------------------- */

export function referencedImages() {
  return entries.flatMap((entry) => entry.images || []);
}

export function moodList() {
  return MOODS;
}

/**
 * A gentle measure of return, not a streak.
 * `run`      consecutive days written, counting back from today or yesterday
 * `recent`   distinct days written in the last 30
 * `sinceLast` days since the most recent page
 */
export function rhythm() {
  const days = new Set(entries.filter(hasSubstance).map((entry) => entry.date));
  const today = todayKey();

  let run = 0;
  let cursor = days.has(today) ? today : null;
  if (!cursor) {
    const yesterday = shift(today, -1);
    if (days.has(yesterday)) cursor = yesterday;
  }
  while (cursor && days.has(cursor)) {
    run += 1;
    cursor = shift(cursor, -1);
  }

  let recent = 0;
  for (const day of days) {
    const gap = daysBetween(day, today);
    if (gap >= 0 && gap < 30) recent += 1;
  }

  const sorted = [...days].sort();
  const last = sorted[sorted.length - 1] || null;

  return {
    run,
    recent,
    totalDays: days.size,
    totalEntries: entries.filter(hasSubstance).length,
    lastDay: last,
    sinceLast: last ? daysBetween(last, today) : null,
  };
}

function shift(key, delta) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return dayKey(date);
}

/** Entries written on this month+day in an earlier year. */
export function onThisDay(key = todayKey()) {
  const [, month, day] = key.split("-");
  const thisYear = key.slice(0, 4);
  return entries.filter((entry) => {
    if (!hasSubstance(entry)) return false;
    const [year, m, d] = entry.date.split("-");
    return m === month && d === day && year < thisYear;
  });
}

/** Search across content, prompt and mood. */
export function search(query, { mood = "", month = "", date = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (!hasSubstance(entry)) return false;
    if (mood && entry.mood !== mood) return false;
    if (month && monthKey(entry.date) !== month) return false;
    if (date && entry.date !== date) return false;
    if (!needle) return true;
    return (
      entry.content.toLowerCase().includes(needle) ||
      (entry.prompt || "").toLowerCase().includes(needle) ||
      (entry.mood || "").toLowerCase().includes(needle) ||
      (entry.promptCategory || "").toLowerCase().includes(needle)
    );
  });
}

export function monthsWithEntries() {
  const counts = new Map();
  for (const entry of entries) {
    if (!hasSubstance(entry)) continue;
    const ym = monthKey(entry.date);
    counts.set(ym, (counts.get(ym) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ym, count]) => ({ ym, count }));
}

/* The fields that make a page what it is. Everything else — updatedAt, and
   the word count derived from content — is bookkeeping, and two copies that
   agree on all of these are the same page however their timestamps differ. */
const MATERIAL_FIELDS = ["content", "mood", "prompt", "promptCategory", "date"];

function sameImages(a, b) {
  const left = a.images || [];
  const right = b.images || [];
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function millis(iso) {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sameContent(a, b) {
  return MATERIAL_FIELDS.every((field) => a[field] === b[field]) && sameImages(a, b);
}

function earliest(a, b) {
  if (!millis(a)) return b;
  if (!millis(b)) return a;
  return millis(a) <= millis(b) ? a : b;
}

/**
 * Merge a previously exported file into this device's journal.
 *
 * Pages are matched by id and the most recent action wins, whether that action
 * was an edit or a deletion. So an edit made on your phone reaches your Mac, a
 * page you deleted on your Mac disappears here too, and a page you deleted and
 * then rewrote stays. A copy that says the same thing is left alone whatever
 * its timestamp claims. A page simply missing from the file — with no deletion
 * record for it — stays put.
 *
 * Returns a summary, or throws if the file isn't a LUMEN export.
 */
export async function importData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.entries)) {
    throw new Error("not a LUMEN export");
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const incoming = data.entries.filter(isEntryish).map(normalise);

  /* Deletion records from both sides, later one winning. These are merged
     before the pages so that a page deleted elsewhere is never re-added on
     its way through. */
  let tombstonesChanged = false;
  const incomingDeleted = data.deleted && typeof data.deleted === "object" ? data.deleted : {};
  for (const [id, when] of Object.entries(incomingDeleted)) {
    if (typeof when !== "string" || !millis(when)) continue;
    if (!deleted[id] || millis(when) > millis(deleted[id])) {
      deleted[id] = when;
      tombstonesChanged = true;
    }
  }

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;

  for (const candidate of incoming) {
    const mine = byId.get(candidate.id);
    const tombstone = deleted[candidate.id];

    // A page written after it was deleted somewhere else is a deliberate
    // revival: the writing is newer than the deletion, so it wins.
    if (tombstone) {
      if (millis(tombstone) >= millis(candidate.updatedAt)) {
        unchanged += 1;
        continue;
      }
      delete deleted[candidate.id];
      tombstonesChanged = true;
    }

    if (!mine) {
      byId.set(candidate.id, candidate);
      added += 1;
    } else if (sameContent(mine, candidate) || millis(candidate.updatedAt) <= millis(mine.updatedAt)) {
      unchanged += 1;
    } else {
      byId.set(candidate.id, {
        ...candidate,
        // An edit made elsewhere shouldn't rewrite when the page was started.
        createdAt: earliest(mine.createdAt, candidate.createdAt),
      });
      updated += 1;
    }
  }

  // Pages held here that were deleted elsewhere afterwards.
  for (const [id, when] of Object.entries(deleted)) {
    const mine = byId.get(id);
    if (!mine) continue;
    if (millis(when) >= millis(mine.updatedAt)) {
      byId.delete(id);
      removed += 1;
    } else {
      // Edited here after being deleted there — keep the page, drop the record.
      delete deleted[id];
      tombstonesChanged = true;
    }
  }

  if (added || updated || removed) {
    entries = [...byId.values()];
    sortEntries();
    writeJSON(KEYS.entries, entries);
  }
  if (tombstonesChanged) writeJSON(KEYS.deleted, deleted);

  let notes = 0;
  if (data.reflections && typeof data.reflections === "object") {
    for (const [ym, value] of Object.entries(data.reflections)) {
      const note = value?.note;
      if (typeof note !== "string" || !note.trim()) continue;

      const mine = reflections[ym];
      if (mine?.note === note) continue;
      if (mine?.note?.trim() && millis(mine.updatedAt) >= millis(value.updatedAt)) continue;

      reflections[ym] = { note, updatedAt: value.updatedAt || new Date().toISOString() };
      notes += 1;
    }
    if (notes) writeJSON(KEYS.reflections, reflections);
  }

  // Pictures arrive before nothing else needs them: a page that references an
  // image the file didn't carry simply shows no picture on this device.
  const photos = await media.importImages(data.images);

  return { added, updated, unchanged, removed, notes, photos };
}

export async function exportData() {
  /* Photographs ride along as base64 so an export stays one file you can
     email to yourself. They are already resized to a few hundred KB each;
     if a library ever grows large enough for this to feel heavy, a zip
     container is the upgrade. */
  const images = await media.exportImages([...new Set(referencedImages())]);
  return {
    app: "LUMEN",
    version: 1,
    deleted,
    exportedAt: new Date().toISOString(),
    entries,
    reflections,
    images,
  };
}

export function clearEverything() {
  /* Deliberately leaves no deletion records. This is a local reset, not a
     page-by-page decision to propagate — and tombstoning everything would
     make your own backups impossible to restore. */
  entries = [];
  reflections = {};
  deleted = {};
  settings = { ...DEFAULT_SETTINGS, theme: settings.theme, onboarded: true };
  writeJSON(KEYS.entries, entries);
  writeJSON(KEYS.reflections, reflections);
  writeJSON(KEYS.deleted, deleted);
  writeJSON(KEYS.settings, settings);
  media.clearAll().catch(() => {});
}
