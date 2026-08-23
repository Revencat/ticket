import type { Ticket } from "../types";

const DB = "ticketbox";
const STORE = "tickets";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("idb blocked"));
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbAll = () => tx<Ticket[]>("readonly", (s) => s.getAll() as IDBRequest<Ticket[]>);
export const idbPut = (t: Ticket) => tx("readwrite", (s) => s.put(t));
export const idbBulk = (ts: Ticket[]) =>
  open().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, "readwrite");
        ts.forEach((x) => t.objectStore(STORE).put(x));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      })
  );
export const idbDel = (id: string) => tx("readwrite", (s) => s.delete(id));
export const idbClear = () => tx("readwrite", (s) => s.clear());
