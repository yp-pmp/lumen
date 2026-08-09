/* ==========================================================================
   store.js — local-first persistence
   Journal content lives in this browser's localStorage and goes nowhere else.
   No fetch, no analytics, no third parties. The shape below is deliberately
   sync-friendly (stable ids + updatedAt) so a future cloud layer could be
   added without reshaping the data.
   ========================================================================== */

import { dayKey, monthKey, todayKey, daysBetween } from "./utils/date.js";
import { countWords } from "./utils/text.js";

const KEYS = {
  entries: "lumen.v1.entries",
  settings: "lumen.v1.settings",
  reflections: "lumen.v1.reflections",
};

const DEFAULT_SETTINGS = {
  theme: "auto",   // auto | light | dark
  onboarded: false,
};

const MOODS = ["Peaceful", "Happy", "Reflective", "Energized", "Tired", "Anxious", "Sad", "Grateful"];

let entries = [];
let settings = { ...DEFAULT_SETTINGS };
let reflections = {};
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
  sortEntries();

  // Another tab wrote something — stay in step.
  window.addEventListener("storage", (event) => {
    if (event.key !== KEYS.entries && event.key !== KEYS.settings && event.key !== KEYS.reflections) return;
    const fresh = readJSON(KEYS.entries, []);
    entries = Array.isArray(fresh) ? fresh.filter(isEntryish).map(normalise) : [];
    settings = { ...DEFAULT_SETTINGS, ...readJSON(KEYS.settings, {}) };
    reflections = readJSON(KEYS.reflections, {}) || {};
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
    isDemo: entry.isDemo === true || undefined,
  };
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
  return record;
}

export function deleteEntry(id) {
  const before = entries.length;
  entries = entries.filter((entry) => entry.id !== id);
  if (entries.length !== before) {
    writeJSON(KEYS.entries, entries);
  }
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
  const days = new Set(entries.filter((entry) => entry.content.trim()).map((entry) => entry.date));
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
    totalEntries: entries.filter((entry) => entry.content.trim()).length,
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
    if (!entry.content.trim()) return false;
    const [year, m, d] = entry.date.split("-");
    return m === month && d === day && year < thisYear;
  });
}

/** Search across content, prompt and mood. */
export function search(query, { mood = "", month = "", date = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (!entry.content.trim()) return false;
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
    if (!entry.content.trim()) continue;
    const ym = monthKey(entry.date);
    counts.set(ym, (counts.get(ym) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ym, count]) => ({ ym, count }));
}

/**
 * Merge a previously exported file into this device's journal.
 * Additive and non-destructive: an entry already here by id is left alone,
 * and an existing month note is never overwritten by an imported one.
 * Returns a summary, or throws if the file isn't a LUMEN export.
 */
export function importData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.entries)) {
    throw new Error("not a LUMEN export");
  }

  const known = new Set(entries.map((entry) => entry.id));
  const incoming = data.entries.filter(isEntryish).map(normalise);
  const fresh = incoming.filter((entry) => !known.has(entry.id));

  if (fresh.length) {
    entries = entries.concat(fresh);
    sortEntries();
    writeJSON(KEYS.entries, entries);
  }

  let notes = 0;
  if (data.reflections && typeof data.reflections === "object") {
    for (const [ym, value] of Object.entries(data.reflections)) {
      const note = value?.note;
      if (typeof note !== "string" || !note.trim()) continue;
      if (reflections[ym]?.note?.trim()) continue;
      reflections[ym] = { note, updatedAt: value.updatedAt || new Date().toISOString() };
      notes += 1;
    }
    if (notes) writeJSON(KEYS.reflections, reflections);
  }

  return { added: fresh.length, skipped: incoming.length - fresh.length, notes };
}

export function exportData() {
  return {
    app: "LUMEN",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    reflections,
  };
}

export function clearEverything() {
  entries = [];
  reflections = {};
  settings = { ...DEFAULT_SETTINGS, theme: settings.theme, onboarded: true };
  writeJSON(KEYS.entries, entries);
  writeJSON(KEYS.reflections, reflections);
  writeJSON(KEYS.settings, settings);
}
