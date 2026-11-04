"use client";

import type { UserTemplate } from "./model";

/**
 * IndexedDB persistence for user templates (device-local; nothing leaves the browser).
 * IndexedDB is used instead of localStorage because templates may carry logo images.
 */

const DB_NAME = "qr-studio";
const DB_VERSION = 1;
const STORE = "templates";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("This browser cannot store templates (IndexedDB unavailable)."));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open template storage."));
    req.onblocked = () => reject(new Error("Template storage is blocked by another tab."));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let value: T | undefined;
      if (req) req.onsuccess = () => (value = req.result);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error("Template storage failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Template storage was aborted (storage may be full)."));
    });
  } finally {
    db.close();
  }
}

export async function listTemplates(): Promise<UserTemplate[]> {
  const all = (await run<UserTemplate[]>("readonly", (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveTemplates(templates: readonly UserTemplate[]): Promise<void> {
  await run("readwrite", (s) => {
    for (const t of templates) s.put(t);
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
