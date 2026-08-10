/* ==========================================================================
   media.js — photographs
   Images are far too large for localStorage (about 5MB total, strings only),
   so the pictures themselves live in IndexedDB as Blobs and entries keep only
   their ids. Like everything else here, nothing is uploaded: the file is read,
   resized and stored entirely on this device.
   ========================================================================== */

const DB_NAME = "lumen";
const DB_VERSION = 1;
const STORE = "images";

/* A phone photo is 2–5MB, which is both wasteful to keep and slow to carry in
   an export. Resized to fit this box it lands around 200–400KB and is still
   sharper than any screen shows it at. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

let dbPromise = null;
const urlCache = new Map();

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run(mode, work) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    let result;
    try {
      result = work(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

function makeId() {
  if (crypto?.randomUUID) return `img_${crypto.randomUUID()}`;
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* --- putting one in ------------------------------------------------------- */

/**
 * Decode a chosen file, resize it, and keep it.
 *
 * Re-encoding through a canvas has a quiet benefit beyond size: it drops the
 * EXIF block, so the GPS coordinates a phone writes into a photo never reach
 * storage or an export. What is kept is the picture, not where you took it.
 */
export async function addImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }

  const source = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(source.image, 0, 0, width, height);
  source.release();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("That image couldn't be read.");

  const record = {
    id: makeId(),
    blob,
    type: "image/jpeg",
    width,
    height,
    bytes: blob.size,
    createdAt: new Date().toISOString(),
  };
  await run("readwrite", (store) => store.put(record));
  return record;
}

/** createImageBitmap honours EXIF rotation; the <img> path is the fallback. */
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch (error) {
      // Some formats (HEIC on a browser without the codec) land here.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That image couldn't be read."));
      element.src = url;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/* --- getting one back ----------------------------------------------------- */

export async function getImage(id) {
  return run("readonly", (store) => store.get(id));
}

/** A displayable URL, made once per image and reused. */
export async function urlFor(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const record = await getImage(id);
  if (!record?.blob) return null;
  const url = URL.createObjectURL(record.blob);
  urlCache.set(id, url);
  return url;
}

function forget(id) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

/* --- taking them away ----------------------------------------------------- */

export async function deleteImages(ids = []) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  for (const id of list) forget(id);
  await run("readwrite", (store) => {
    for (const id of list) store.delete(id);
  });
}

export async function clearAll() {
  for (const id of [...urlCache.keys()]) forget(id);
  await run("readwrite", (store) => store.clear());
}

/**
 * Drop pictures no entry points at any more — the residue of a page deleted
 * in another tab, or an import that replaced one.
 */
export async function pruneOrphans(referenced) {
  const keep = new Set(referenced);
  const ids = await run("readonly", (store) => store.getAllKeys());
  const orphans = (ids || []).filter((id) => !keep.has(id));
  if (orphans.length) await deleteImages(orphans);
  return orphans.length;
}

/* --- carrying them between devices ---------------------------------------- */

export async function exportImages(ids) {
  const out = {};
  for (const id of ids) {
    const record = await getImage(id);
    if (!record?.blob) continue;
    out[id] = {
      type: record.type || "image/jpeg",
      width: record.width,
      height: record.height,
      createdAt: record.createdAt,
      data: await blobToBase64(record.blob),
    };
  }
  return out;
}

/** Store images from an export, leaving any already here untouched. */
export async function importImages(map) {
  if (!map || typeof map !== "object") return 0;
  let added = 0;
  for (const [id, value] of Object.entries(map)) {
    if (typeof value?.data !== "string") continue;
    if (await getImage(id)) continue;
    const blob = base64ToBlob(value.data, value.type || "image/jpeg");
    await run("readwrite", (store) => store.put({
      id,
      blob,
      type: value.type || "image/jpeg",
      width: value.width,
      height: value.height,
      bytes: blob.size,
      createdAt: value.createdAt || new Date().toISOString(),
    }));
    added += 1;
  }
  return added;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* Decoded by hand rather than via fetch("data:…") so that the app keeps its
   property of making no fetch calls at all. */
function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function isSupported() {
  return typeof indexedDB !== "undefined";
}
